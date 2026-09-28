// Step 3 of the home-restructure build: the app has zero fill_in (typed-
// answer) cards today, and the Guided Learning Session's Core phase (C2)
// needs a real pool of them to draw ~15 due cards from per session. This
// generates an initial batch, per objective of the active certification, in
// two grading modes:
//   - 'exact': a single-term/acronym/port/protocol answer, graded via
//     gradeFillIn's string-match + AI near-miss fallback
//     (src/lib/fill-in-grading.ts).
//   - 'ai': a "explain in 1-2 sentences why/how..." question, graded by
//     gradeFillInExplanation as correct/partial/wrong
//     (src/lib/fill-in-explanation-grading.ts).
//
// Usage:
//   npx dotenv-cli -c -- npx tsx scripts/generate-fillin-cards.ts --sample
//   npx dotenv-cli -c -- npx tsx scripts/generate-fillin-cards.ts --sample-explanation
//   npx dotenv-cli -c -- npx tsx scripts/generate-fillin-cards.ts [--certification-id=<uuid>] [--count-per-objective=N]
//
// --sample / --sample-explanation only print, nothing is written to the DB.
// The real run auto-approves (status: 'active') any card that passes
// checkFillInConsistency — same policy as the MC/MS generation scripts
// (e.g. generate-security-architecture-cards.ts) — and leaves only
// structural failures as 'pending' for a human look via /review.

import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { getDb } from '../src/db';
import { cards } from '../src/db/schema';
import { getCurrentUser } from '../src/lib/auth';
import { AI_MODELS } from '../src/lib/ai-models';
import { checkFillInConsistency } from '../src/lib/card-consistency';
import type { FillInContent } from '../src/db/question-types';
import { parseCertificationIdArg, resolveCliCertification, type CliCertification, type CliObjective } from './cli-certification';

const MODEL = AI_MODELS.content;
const BATCH_SIZE = 8;
const DEFAULT_COUNT_PER_OBJECTIVE = 3;
const SAMPLE_SIZE = 5;
const EXPLANATION_SAMPLE_SIZE = 3;

const client = new Anthropic();

type GradingMode = 'exact' | 'ai';
type Difficulty = 'recall' | 'application';
type Slot = { objective: CliObjective; gradingMode: GradingMode; difficulty: Difficulty };

// 2 term cards + 1 explanation card per objective by default (count=3).
// Generalizes proportionally (~2/3 exact, ~1/3 ai) for any other
// --count-per-objective, always at least 1 exact card.
function splitGradingModes(count: number): { exact: number; ai: number } {
  const exact = Math.max(1, Math.round((count * 2) / 3));
  return { exact, ai: Math.max(0, count - exact) };
}

function buildSlotsForObjective(objective: CliObjective, count: number): Slot[] {
  const { exact, ai } = splitGradingModes(count);
  const slots: Slot[] = [];
  for (let i = 0; i < exact; i++) {
    slots.push({ objective, gradingMode: 'exact', difficulty: i % 2 === 0 ? 'recall' : 'application' });
  }
  for (let i = 0; i < ai; i++) {
    slots.push({ objective, gradingMode: 'ai', difficulty: 'application' });
  }
  return slots;
}

function buildFullSlotPlan(objectives: CliObjective[], countPerObjective: number): Slot[] {
  return objectives.flatMap((o) => buildSlotsForObjective(o, countPerObjective));
}

// Round-robins through domains first so a small sample spans different
// parts of the exam rather than clustering in whichever objective sorts
// first.
function pickObjectivesAcrossDomains(objectives: CliObjective[], n: number): CliObjective[] {
  const byDomain = new Map<string, CliObjective[]>();
  for (const o of objectives) {
    if (!byDomain.has(o.domain)) byDomain.set(o.domain, []);
    byDomain.get(o.domain)!.push(o);
  }
  const domains = [...byDomain.keys()];
  const picked: CliObjective[] = [];
  let d = 0;
  while (picked.length < n && picked.length < objectives.length) {
    const domainObjectives = byDomain.get(domains[d % domains.length])!;
    const next = domainObjectives.shift();
    if (next) picked.push(next);
    d++;
    if (domains.every((name) => byDomain.get(name)!.length === 0)) break;
  }
  return picked;
}

function buildSampleSlots(objectives: CliObjective[]): Slot[] {
  const difficulties: Difficulty[] = ['recall', 'application'];
  return pickObjectivesAcrossDomains(objectives, SAMPLE_SIZE).map((objective, i) => ({
    objective,
    gradingMode: 'exact',
    difficulty: difficulties[i % difficulties.length],
  }));
}

function buildExplanationSampleSlots(objectives: CliObjective[]): Slot[] {
  return pickObjectivesAcrossDomains(objectives, EXPLANATION_SAMPLE_SIZE).map((objective) => ({
    objective,
    gradingMode: 'ai',
    difficulty: 'application',
  }));
}

const GeneratedCardSchema = z.object({
  objective: z.string(),
  topic: z.string(),
  question: z.string(),
  acceptedAnswers: z.array(z.string()).min(1),
  explanation: z.string(),
});
const BatchResultSchema = z.object({ cards: z.array(GeneratedCardSchema) });
type GeneratedCard = z.infer<typeof GeneratedCardSchema>;

function submitCardsTool(cert: CliCertification): Anthropic.Tool {
  return {
    name: 'submit_cards',
    description: `Submit a batch of typed-answer ${cert.name} (${cert.examCode}) practice questions.`,
    input_schema: {
      type: 'object',
      properties: {
        cards: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              objective: { type: 'string', description: 'The exact objective number this card was written for, copied from the spec' },
              topic: { type: 'string', description: 'Short topic label, 2-5 words' },
              question: { type: 'string' },
              acceptedAnswers: {
                type: 'array',
                items: { type: 'string' },
                description:
                  'For a term-mode spec: 1-3 literal correct answers, TRUE equivalents only (an acronym and its own full expansion, or a genuine spelling/wording variant of the SAME term) — never a related-but-different concept, even a plausible one. For an explanation-mode spec: 2-4 short key-point phrases the answer should cover.',
              },
              explanation: { type: 'string', description: 'Why this is the answer — 1-2 sentences' },
            },
            required: ['objective', 'topic', 'question', 'acceptedAnswers', 'explanation'],
          },
        },
      },
      required: ['cards'],
    },
  };
}

function buildPrompt(slots: Slot[], cert: CliCertification): string {
  const spec = slots
    .map((s, i) => {
      const label = s.objective.title ? `${s.objective.number} — ${s.objective.title}` : s.objective.number;
      const modeLabel = s.gradingMode === 'exact' ? 'TERM' : 'EXPLANATION';
      return `${i + 1}. mode: ${modeLabel}, objective: "${s.objective.number}" (${label}, domain: "${s.objective.domain}"), difficulty target: ${s.difficulty}`;
    })
    .join('\n');

  return `Generate ${slots.length} original ${cert.name} (${cert.examCode}) typed-answer practice questions, one per spec below. Every spec is one of two modes — follow the mode exactly:

TERM mode (short-answer): the test-taker types a single short fact — a term, an acronym, a port number, a protocol name, an attack/control name. NOT a sentence.
- "recall" difficulty: ask directly for the term/fact ("What port does X use?", "What is the term for...").
- "application" difficulty: describe a short scenario (1-2 sentences) and ask what term/control/protocol it's describing — still answered with one short fact, the scenario just makes them recognize it rather than recite it.
- Never write a TERM question whose answer is a yes/no, an open-ended range, or a subjective judgment call — the answer must be one specific, checkable fact.
- acceptedAnswers for TERM mode: every natural way someone would correctly answer that same fact — an acronym AND its own full expansion when both are natural ("MFA" / "multi-factor authentication"), or a plain number ("443"). TRUE EQUIVALENTS ONLY: every listed answer must mean the exact same thing as every other listed answer for this question — never a different-but-related concept, even a common colloquial one (e.g. for a question about the switch feature that restricts a port to specific MAC addresses, the answer is "port security" — do NOT also list "MAC filtering", which is a different, broader concept, not this feature's name). Do not add redundant case variants — matching is already case-insensitive. Every listed answer must be unambiguously correct standing alone.

EXPLANATION mode (short free-text): the test-taker writes 1-2 sentences. The question MUST literally ask them to explain — start it with "Explain..." or "Why..." or "How..." (e.g. "Explain why rotating encryption keys periodically reduces the impact of a key compromise.").
- Ask about a genuine mechanism, reason, or tradeoff within the objective — not something answerable with a single word (that belongs in TERM mode instead).
- acceptedAnswers for EXPLANATION mode: 2-4 short key-point phrases (not full sentences) a correct answer needs to touch on — these are grading criteria for an AI judge, not literal strings to match verbatim.

BOTH modes:
- Every question must be answerable from the given objective's own subject matter — stay strictly within scope of the objective listed, don't drift into a different objective's territory.

objective: copy the objective number from the spec EXACTLY as given.
topic: a short 2-5 word label for this specific question's subtopic.
explanation: 1-2 sentences — for TERM mode, why that's the answer; for EXPLANATION mode, a full model answer (also shown to the learner and given to the AI grader as reference).

Specs:
${spec}

Call submit_cards with exactly ${slots.length} entries, in the same order as the specs above.`;
}

async function generateBatch(slots: Slot[], cert: CliCertification): Promise<GeneratedCard[]> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    tools: [submitCardsTool(cert)],
    tool_choice: { type: 'tool', name: 'submit_cards' },
    messages: [{ role: 'user', content: buildPrompt(slots, cert) }],
  });

  const toolUse = response.content.find((block): block is Anthropic.ToolUseBlock => block.type === 'tool_use');
  if (!toolUse) throw new Error('No tool_use block in response');

  return BatchResultSchema.parse(toolUse.input).cards;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function printCard(card: GeneratedCard, domain: string, gradingMode: GradingMode, issues: string[]) {
  console.log(`\n--- [${domain}] ${card.topic} (obj ${card.objective}, ${gradingMode})`);
  console.log(`Q: ${card.question}`);
  console.log(`${gradingMode === 'exact' ? 'Accepted' : 'Key points'}: ${card.acceptedAnswers.map((a) => `"${a}"`).join(', ')}`);
  console.log(`Explanation: ${card.explanation}`);
  if (issues.length > 0) {
    console.log(`STRUCTURAL ISSUES: ${issues.join('; ')}`);
  }
}

async function main() {
  const sampleArg = process.argv.includes('--sample');
  const sampleExplanationArg = process.argv.includes('--sample-explanation');
  const certificationId = parseCertificationIdArg();
  const cert = await resolveCliCertification(certificationId);
  console.log(`Target certification: ${cert.name} (${cert.examCode})`);

  if (cert.objectives.length === 0) {
    throw new Error(`${cert.name} has no objectives yet — seed its objectives table before generating fill_in cards.`);
  }

  const countArg = process.argv.find((a) => a.startsWith('--count-per-objective='));
  const countPerObjective = countArg ? Number(countArg.slice('--count-per-objective='.length)) : DEFAULT_COUNT_PER_OBJECTIVE;

  const slots = sampleExplanationArg
    ? buildExplanationSampleSlots(cert.objectives)
    : sampleArg
      ? buildSampleSlots(cert.objectives)
      : buildFullSlotPlan(cert.objectives, countPerObjective);
  const isSample = sampleArg || sampleExplanationArg;
  console.log(`Generating ${slots.length} card(s)${isSample ? ' (SAMPLE — not written to DB)' : ` across ${cert.objectives.length} objective(s)`}...`);

  const domainByObjective = new Map(cert.objectives.map((o) => [o.number, o.domain]));
  const db = getDb();
  const user = await getCurrentUser();
  const batches = chunk(slots, BATCH_SIZE);
  let activeCount = 0;
  let pendingCount = 0;

  for (const [i, batch] of batches.entries()) {
    console.log(`Batch ${i + 1}/${batches.length} (${batch.length} cards)...`);
    const generated = await generateBatch(batch, cert);

    for (const card of generated) {
      const slot = batch.find((s) => s.objective.number === card.objective);
      const gradingMode: GradingMode = slot?.gradingMode ?? 'exact';
      const domain = domainByObjective.get(card.objective) ?? slot?.objective.domain ?? 'Unknown';
      const content: FillInContent = { question: card.question, gradingMode, acceptedAnswers: card.acceptedAnswers, explanation: card.explanation };
      const issues = checkFillInConsistency(content);

      if (isSample) {
        printCard(card, domain, gradingMode, issues);
        continue;
      }

      // Auto-approve on structural pass — same policy as the MC/MS
      // generation scripts (e.g. generate-security-architecture-cards.ts):
      // only a structural failure holds a card for human review.
      const status = issues.length === 0 ? 'active' : 'pending';

      await db.insert(cards).values({
        userId: user.id,
        certificationId: cert.id,
        domain,
        topic: card.topic,
        type: 'fill_in',
        content,
        status,
        sourceType: 'generated',
        authoredDifficulty: slot?.difficulty ?? null,
        objective: card.objective,
      });
      if (status === 'active') {
        activeCount++;
      } else {
        pendingCount++;
        console.log(`  Held for review [obj ${card.objective}] ${card.topic}: ${issues.join('; ')}`);
      }
    }
  }

  if (isSample) {
    console.log('\nSample complete — nothing written to the database.');
  } else {
    console.log(`\nInserted ${activeCount} active card(s), ${pendingCount} held as pending on structural check.${pendingCount > 0 ? ' Review those at /review.' : ''}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
