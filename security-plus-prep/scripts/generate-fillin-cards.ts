// Step 3 of the home-restructure build: the app has zero fill_in (typed-
// answer) cards today, and the Guided Learning Session's Core phase (C2)
// needs a real pool of them to draw ~15 due cards from per session. This
// generates an initial batch, one to several cards per objective of the
// active certification — reusing gradeFillIn's existing near-miss grading
// design (src/lib/fill-in-grading.ts), which expects short factual answers
// (a term, acronym, port, protocol name), not essay-length recall.
//
// Usage:
//   npx dotenv-cli -c -- npx tsx scripts/generate-fillin-cards.ts --sample
//   npx dotenv-cli -c -- npx tsx scripts/generate-fillin-cards.ts [--certification-id=<uuid>] [--count-per-objective=N]
//
// --sample generates exactly 5 cards spanning different objectives/domains
// and only prints them — nothing is written to the DB. Per the build plan,
// review the sample before running the real (unflagged) invocation.

import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { getDb } from '../src/db';
import { cards } from '../src/db/schema';
import { getCurrentUser } from '../src/lib/auth';
import { AI_MODELS } from '../src/lib/ai-models';
import { checkFillInConsistency } from '../src/lib/card-consistency';
import { parseCertificationIdArg, resolveCliCertification, type CliCertification, type CliObjective } from './cli-certification';

const MODEL = AI_MODELS.content;
const BATCH_SIZE = 8;
const DEFAULT_COUNT_PER_OBJECTIVE = 3;
const SAMPLE_SIZE = 5;

const client = new Anthropic();

type Difficulty = 'recall' | 'application' | 'analysis';
type Slot = { objective: CliObjective; difficulty: Difficulty };

// Typed-answer questions suit recall-difficulty content best (a term, a
// port, an acronym expansion) more than application/analysis scenarios,
// which usually need several plausible options to be meaningful — but
// including some application-difficulty slots still gives useful "name the
// concept this scenario describes" questions.
const DIFFICULTY_WEIGHTS: Difficulty[] = ['recall', 'recall', 'application'];

function buildSlotsForObjective(objective: CliObjective, count: number): Slot[] {
  return Array.from({ length: count }, (_, i) => ({
    objective,
    difficulty: DIFFICULTY_WEIGHTS[i % DIFFICULTY_WEIGHTS.length],
  }));
}

function buildFullSlotPlan(objectives: CliObjective[], countPerObjective: number): Slot[] {
  return objectives.flatMap((o) => buildSlotsForObjective(o, countPerObjective));
}

// Spread across up to SAMPLE_SIZE distinct objectives (round-robin through
// domains first) rather than clustering in whichever objective sorts first.
function buildSampleSlots(objectives: CliObjective[]): Slot[] {
  const byDomain = new Map<string, CliObjective[]>();
  for (const o of objectives) {
    if (!byDomain.has(o.domain)) byDomain.set(o.domain, []);
    byDomain.get(o.domain)!.push(o);
  }
  const domains = [...byDomain.keys()];
  const picked: CliObjective[] = [];
  let d = 0;
  while (picked.length < SAMPLE_SIZE && picked.length < objectives.length) {
    const domainObjectives = byDomain.get(domains[d % domains.length])!;
    const next = domainObjectives.shift();
    if (next) picked.push(next);
    d++;
    if (domains.every((name) => byDomain.get(name)!.length === 0)) break;
  }
  return picked.map((objective, i) => ({ objective, difficulty: DIFFICULTY_WEIGHTS[i % DIFFICULTY_WEIGHTS.length] }));
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
    description: `Submit a batch of typed-answer (fill-in-the-blank) ${cert.name} (${cert.examCode}) practice questions.`,
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
              question: {
                type: 'string',
                description:
                  'A short-answer question whose answer is a single term, acronym, port number, protocol name, or similarly short fact — NOT a question that needs a sentence or list to answer correctly.',
              },
              acceptedAnswers: {
                type: 'array',
                items: { type: 'string' },
                description:
                  '1-4 acceptable answers covering real phrasing variants (e.g. an acronym AND its expansion if both are natural answers) — matching is already case-insensitive, so do not list case variants of the same phrase.',
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
      return `${i + 1}. objective: "${s.objective.number}" (${label}, domain: "${s.objective.domain}"), authoredDifficulty target: ${s.difficulty}`;
    })
    .join('\n');

  return `Generate ${slots.length} original ${cert.name} (${cert.examCode}) typed-answer (fill-in-the-blank) practice questions, one per spec below. These are SHORT-ANSWER questions — the test-taker types a word or short phrase, not multiple choice.

STYLE:
- The answer must be a single short fact: a term, an acronym, a port number, a protocol name, an attack/control name, or similarly compact. If a concept genuinely needs a sentence to answer, it's the wrong fit for this format — pick a narrower, more specific fact within the same objective instead.
- "recall" difficulty target: ask directly for the term/fact ("What port does X use?", "What is the term for...").
- "application" difficulty target: describe a short scenario (1-2 sentences) and ask what term/control/protocol it's describing — the test-taker still answers with one short fact, the scenario just makes them recognize it rather than recite it.
- Every question must be answerable from the given objective's own subject matter — stay strictly within scope of the objective listed, don't drift into a different objective's territory.
- Never write a question whose answer is a yes/no, a number range with no fixed value, or a subjective judgment call — the answer must be one specific, checkable fact.

acceptedAnswers:
- List every natural way someone would correctly answer, e.g. both an acronym and its full expansion when either is a normal answer ("MFA" and "multi-factor authentication"), or a port number written plainly ("443") — but do NOT add redundant case variants, matching is already case-insensitive.
- Every listed answer must be unambiguously correct on its own — no partial answers.

objective: copy the objective number from the spec EXACTLY as given.
topic: a short 2-5 word label for this specific question's subtopic.

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

function printCard(card: GeneratedCard, domain: string, issues: string[]) {
  console.log(`\n--- [${domain}] ${card.topic} (obj ${card.objective})`);
  console.log(`Q: ${card.question}`);
  console.log(`Accepted: ${card.acceptedAnswers.map((a) => `"${a}"`).join(', ')}`);
  console.log(`Explanation: ${card.explanation}`);
  if (issues.length > 0) {
    console.log(`STRUCTURAL ISSUES: ${issues.join('; ')}`);
  }
}

async function main() {
  const sampleArg = process.argv.includes('--sample');
  const certificationId = parseCertificationIdArg();
  const cert = await resolveCliCertification(certificationId);
  console.log(`Target certification: ${cert.name} (${cert.examCode})`);

  if (cert.objectives.length === 0) {
    throw new Error(`${cert.name} has no objectives yet — seed its objectives table before generating fill_in cards.`);
  }

  const countArg = process.argv.find((a) => a.startsWith('--count-per-objective='));
  const countPerObjective = countArg ? Number(countArg.slice('--count-per-objective='.length)) : DEFAULT_COUNT_PER_OBJECTIVE;

  const slots = sampleArg ? buildSampleSlots(cert.objectives) : buildFullSlotPlan(cert.objectives, countPerObjective);
  console.log(`Generating ${slots.length} card(s)${sampleArg ? ' (SAMPLE — not written to DB)' : ` across ${cert.objectives.length} objective(s)`}...`);

  const domainByObjective = new Map(cert.objectives.map((o) => [o.number, o.domain]));
  const db = getDb();
  const user = await getCurrentUser();
  const batches = chunk(slots, BATCH_SIZE);
  let total = 0;
  let rejected = 0;

  for (const [i, batch] of batches.entries()) {
    console.log(`Batch ${i + 1}/${batches.length} (${batch.length} cards)...`);
    const generated = await generateBatch(batch, cert);

    for (const card of generated) {
      const domain = domainByObjective.get(card.objective) ?? batch.find((s) => s.objective.number === card.objective)?.objective.domain ?? 'Unknown';
      const content = { question: card.question, acceptedAnswers: card.acceptedAnswers, explanation: card.explanation };
      const issues = checkFillInConsistency(content);

      if (sampleArg) {
        printCard(card, domain, issues);
        continue;
      }

      await db.insert(cards).values({
        userId: user.id,
        certificationId: cert.id,
        domain,
        topic: card.topic,
        type: 'fill_in',
        content,
        status: issues.length > 0 ? 'rejected' : 'pending',
        sourceType: 'generated',
        authoredDifficulty: batch.find((s) => s.objective.number === card.objective)?.difficulty ?? null,
        objective: card.objective,
      });
      if (issues.length > 0) {
        rejected++;
        console.log(`  Auto-rejected [obj ${card.objective}] ${card.topic}: ${issues.join('; ')}`);
      } else {
        total++;
      }
    }
  }

  if (sampleArg) {
    console.log('\nSample complete — nothing written to the database.');
  } else {
    console.log(`\nInserted ${total} pending card(s)${rejected > 0 ? ` (${rejected} auto-rejected on structural check)` : ''}. Run scripts/check-card-consistency.ts, then scripts/review-new-cards.ts to approve.`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
