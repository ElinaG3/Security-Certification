// Generates 15 new General Security Concepts cards in the same
// scenario-based, BEST-answer style established by
// rewrite-legacy-cards.ts (varied CompTIA qualifiers, varied scenario
// length, grounded distractor explanations) — but as fresh content, not
// a rewrite of an existing card. Targets SY0-701 domain 1.0's four
// objectives directly, with explicit slots to close the biggest gap in
// current coverage: objective 1.3 (change management) has zero active
// cards today.
//
// Pipeline: generate in batches -> run the existing structural
// consistency check -> on pass, insert directly as 'active' -> on fail,
// retry up to 3 attempts -> still-failing cards land as 'pending' for
// manual review (nothing bad ever reaches 'active').
//
// Usage:
//   npx dotenv-cli -e .env -- tsx scripts/generate-gsc-cards.ts

import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { getDb } from '../src/db';
import { cards } from '../src/db/schema';
import { getCurrentUser } from '../src/lib/auth';
import { AI_MODELS } from '../src/lib/ai-models';
import { checkCardConsistency } from './check-card-consistency';

const MODEL = AI_MODELS.content;
const BATCH_SIZE = 5;
const DOMAIN = 'General Security Concepts';

const client = new Anthropic();

const QUALIFIERS = ['BEST', 'MOST likely', 'FIRST', 'MOST cost-effective', 'GREATEST risk'] as const;
type Qualifier = (typeof QUALIFIERS)[number];
type LengthTier = 'short' | 'full';

type Slot = {
  objective: string;
  hint: string;
  type: 'multiple_choice' | 'multiple_select';
  requiredCount?: number;
  qualifier: Qualifier;
  lengthTier: LengthTier;
};

// Explicit per-card plan instead of letting the model pick objectives
// freely: objective 1.3 (change management) currently has zero active
// cards, so it gets 4 of the 15 here. The rest fill specific gaps in
// 1.1/1.2/1.4 (physical controls, integrity/availability, AAA, deception
// tech, cert revocation, salting) rather than re-testing ground already
// well covered (RBAC, least privilege, confidentiality).
const PLAN: Omit<Slot, 'qualifier' | 'lengthTier'>[] = [
  { objective: '1.1', hint: 'classifying a control as preventive, detective, deterrent, or corrective', type: 'multiple_choice' },
  { objective: '1.1', hint: 'physical security controls (badge readers, mantraps, camera systems, security guards)', type: 'multiple_select', requiredCount: 2 },
  { objective: '1.1', hint: 'managerial vs. technical vs. operational control categories', type: 'multiple_choice' },
  { objective: '1.2', hint: 'an integrity failure (e.g. undetected tampering with data or logs) — CIA triad, not confidentiality', type: 'multiple_choice' },
  { objective: '1.2', hint: 'an availability failure or the redundancy/resiliency control that addresses it — CIA triad, not confidentiality', type: 'multiple_choice' },
  { objective: '1.2', hint: 'the AAA framework — distinguishing authentication, authorization, and accounting in a single scenario', type: 'multiple_select', requiredCount: 2 },
  { objective: '1.2', hint: 'deception/disruption technology (honeypot, honeynet, or decoy asset)', type: 'multiple_choice' },
  { objective: '1.3', hint: 'the FIRST step in a formal change management process before a change is implemented (e.g. submitting a request to a change advisory board)', type: 'multiple_choice' },
  { objective: '1.3', hint: 'why impact analysis matters before approving a proposed change', type: 'multiple_choice' },
  { objective: '1.3', hint: 'the importance of a rollback/backout plan as part of change management', type: 'multiple_select', requiredCount: 2 },
  { objective: '1.3', hint: 'the risk of undocumented or unapproved changes bypassing the change management process', type: 'multiple_choice' },
  { objective: '1.4', hint: 'choosing symmetric vs. asymmetric encryption for a given key-exchange scenario', type: 'multiple_choice' },
  { objective: '1.4', hint: 'digital signatures providing non-repudiation', type: 'multiple_choice' },
  { objective: '1.4', hint: 'certificate revocation checking (CRL vs. OCSP)', type: 'multiple_select', requiredCount: 3 },
  { objective: '1.4', hint: 'salting hashed passwords to defeat rainbow table attacks', type: 'multiple_choice' },
];

// Sequence-sensitive slots (change management) get FIRST most of the
// time, same as rewrite-legacy-cards.ts's SEQUENCE_TOPICS handling —
// everything else round-robins across all 5 qualifiers so BEST doesn't
// dominate the batch.
function assignQualifier(objective: string, indexInObjective: number, indexOverall: number): Qualifier {
  if (objective === '1.3') {
    return indexInObjective % 3 === 2 ? 'GREATEST risk' : 'FIRST';
  }
  return QUALIFIERS[indexOverall % QUALIFIERS.length];
}

// ~1/3 short, ~2/3 full scenario — matches the legacy rewrite batch so
// this new content doesn't stand out by format alone.
function assignLengthTier(indexOverall: number): LengthTier {
  return indexOverall % 3 === 0 ? 'short' : 'full';
}

function buildSlots(): Slot[] {
  const objectiveCounters = new Map<string, number>();
  return PLAN.map((p, i) => {
    const objIndex = objectiveCounters.get(p.objective) ?? 0;
    objectiveCounters.set(p.objective, objIndex + 1);
    return {
      ...p,
      qualifier: assignQualifier(p.objective, objIndex, i),
      lengthTier: assignLengthTier(i),
    };
  });
}

const GeneratedCardSchema = z.object({
  type: z.enum(['multiple_choice', 'multiple_select']),
  topic: z.string(),
  authoredDifficulty: z.enum(['application', 'analysis']),
  question: z.string(),
  options: z.array(z.string()),
  correct: z.union([z.number(), z.array(z.number())]),
  requiredCount: z.number().optional(),
  explanation: z.string(),
  distractorExplanations: z.array(z.string()),
});
const BatchResultSchema = z.object({ cards: z.array(GeneratedCardSchema) });
type GeneratedCard = z.infer<typeof GeneratedCardSchema>;

const submitCardsTool: Anthropic.Tool = {
  name: 'submit_cards',
  description: 'Submit a batch of new CompTIA Security+ (SY0-701) General Security Concepts practice questions.',
  input_schema: {
    type: 'object',
    properties: {
      cards: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['multiple_choice', 'multiple_select'] },
            topic: { type: 'string', description: 'Short 2-5 word topic label for this specific question' },
            authoredDifficulty: { type: 'string', enum: ['application', 'analysis'] },
            question: { type: 'string' },
            options: { type: 'array', items: { type: 'string' } },
            correct: {
              description: 'Index into options for multiple_choice, array of indices for multiple_select',
              oneOf: [{ type: 'integer' }, { type: 'array', items: { type: 'integer' } }],
            },
            requiredCount: { type: 'integer', description: 'multiple_select only: how many options must be picked' },
            explanation: { type: 'string', description: 'Why the correct answer is BEST' },
            distractorExplanations: {
              type: 'array',
              items: { type: 'string' },
              description:
                'MUST have exactly options.length entries, same order as options. "" at every correct index, a context-specific reason at every other index.',
            },
          },
          required: ['type', 'topic', 'authoredDifficulty', 'question', 'options', 'correct', 'explanation', 'distractorExplanations'],
        },
      },
    },
    required: ['cards'],
  },
};

function buildPrompt(slots: Slot[]): string {
  const spec = slots
    .map((s, i) => {
      const lines = [
        `${i + 1}. SY0-701 objective ${s.objective} (General Security Concepts)`,
        `   subtopic to test: ${s.hint}`,
        `   type: ${s.type}`,
        `   qualifier: ${s.qualifier}`,
        `   length: ${s.lengthTier}`,
        s.type === 'multiple_select' ? `   requiredCount: ${s.requiredCount}` : null,
      ].filter(Boolean);
      return lines.join('\n');
    })
    .join('\n\n');

  return `Write ${slots.length} original CompTIA Security+ (SY0-701) practice questions for domain 1.0, General Security Concepts, one per spec below. Each must be a completely new scenario-based question testing the assigned subtopic.

WHY THIS MATTERS: candidate feedback on the real SY0-701 exam consistently says the hard part isn't obscure facts — it's that multiple options all look correct, and you must pick the BEST one by CompTIA's logic. These must recreate that difficulty, not test rote recall.

EVERY QUESTION — including multiple_select — has EXACTLY 4 options TOTAL. Never 5, never 6. options.length === 4 always. This is non-negotiable: for a multiple_select card with requiredCount 2, that means exactly 2 correct + 2 incorrect = 4 total, not 2 correct + 3 incorrect.

EVERY QUESTION:
- Each spec below carries its own "qualifier" and "length" — follow BOTH exactly as assigned, do not substitute your own choice or default to BEST/full-scenario.
- length "full": 2-4 sentences of realistic organizational scenario (a company, a role, a constraint, an incident in progress) before the question itself.
- length "short": 0-2 sentences of setup — even a direct, compact one-line question is fine here. Real exam questions aren't all elaborate scenarios.
- qualifier "FIRST": the question is about sequence/priority — "what should be done FIRST" — and at least two options must be real, later-but-still-correct steps in the same process, not just wrong actions. This applies especially to the change-management specs below, where getting the order right is the actual skill being tested.
- End every question with its assigned qualifier, worded naturally (e.g. "Which of the following is the FIRST step..." / "...the MOST cost-effective solution?" / "...poses the GREATEST risk?"). For multiple_select, phrase around selecting multiple (e.g. "Which TWO of the following...") while still ending on the assigned qualifier where it fits naturally.
- All 4 options must be real, plausible, legitimate security controls or concepts — never a throwaway or nonsensical distractor. For multiple_choice: at least TWO of the four must be genuinely defensible responses to the scenario; only ONE is the BEST answer. For multiple_select: exactly requiredCount are correct, and the remaining (4 - requiredCount) are plausible-but-inferior in the same grounded way.

multiple_select DISTRACTOR QUALITY — this is exactly where generated "Choose two/three" questions tend to go weak: every wrong option must be a legitimate, real-world control a competent practitioner might genuinely reach for — plausible in general, wrong ONLY because of a specific detail in THIS scenario (wrong layer, wrong phase, wrong scope, wrong cost tier, solves a different risk). If a wrong option could be eliminated just by recognizing it's not a real or sensible control — without needing to read the scenario at all — rewrite it. A test-taker should need to understand the scenario to eliminate every wrong option, never just skim the option list and spot the silly ones.

DISTRACTOR EXPLANATIONS — the highest-value part, do not skimp:
- EVERY wrong option, no exceptions, gets a real, specific, non-empty explanation written out in full.
- Each one must say SPECIFICALLY why it is worse in THIS scenario, not merely "wrong" or a restatement of the correct answer. Ground each one in something concrete: wrong phase/sequence, treats a symptom instead of the root cause, fails a specific constraint stated in the scenario (cost, time, scope, regulatory), or is a real control that solves a different, adjacent problem than the one described.
- The top-level 'explanation' field must be genuine prose, written out in full, explaining why the correct answer(s) are BEST.

distractorExplanations ARRAY ALIGNMENT — this has been a source of bugs, follow it exactly:
- distractorExplanations must have EXACTLY the same length as options (4), one entry per option, in the SAME ORDER as options — do not build it by skipping the correct option and only listing the wrong ones. A 4-option card gets a 4-entry distractorExplanations array, always, never 3.
- The entry at each correct index (single index for multiple_choice, every index in correct[] for multiple_select) must be the empty string "".
- Every other index must have a non-empty, option-specific explanation.
- Before finalizing each card, verify: len(distractorExplanations) === len(options) === 4, and distractorExplanations[i] === "" if and only if i is a correct index.

multiple_select cards: the question text MUST end with "(Choose ${'{requiredCount}'}.)" matching the spec's requiredCount exactly (e.g. "(Choose two.)" or "(Choose three.)"). correct must be an array with exactly requiredCount indices, options must still have exactly 4 entries total.

topic: a short 2-5 word label for this specific question's subtopic (e.g. "Change Advisory Board", "Certificate Revocation").
authoredDifficulty: "application" or "analysis" only — never "recall". These are judgment calls, not fact lookups, so do not include a mnemonic.

Specs:
${spec}

Call submit_cards with exactly ${slots.length} entries, in the same order as the specs above.`;
}

// Parses each card independently instead of the whole batch as one Zod
// object, so one malformed card doesn't throw away — or crash the run on
// — the other cards in the same batch.
async function generateBatch(slots: Slot[]): Promise<(GeneratedCard | null)[]> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8192,
    tools: [submitCardsTool],
    tool_choice: { type: 'tool', name: 'submit_cards' },
    messages: [{ role: 'user', content: buildPrompt(slots) }],
  });

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
  );
  if (!toolUse) throw new Error('No tool_use block in response');

  const rawCardsField = (toolUse.input as { cards?: unknown })?.cards;
  const rawCards = Array.isArray(rawCardsField) ? rawCardsField : [];
  if (!Array.isArray(rawCardsField)) {
    console.log(`  GENERATION FAILURE: tool input 'cards' was not an array (got ${typeof rawCardsField})`);
  }
  return rawCards.map((raw, i) => {
    const parsed = GeneratedCardSchema.safeParse(raw);
    if (parsed.success) return parsed.data;
    console.log(`  GENERATION PARSE FAILURE for slot ${i} (objective ${slots[i]?.objective}):`);
    console.log(`    ${parsed.error.issues.map((iss) => `${iss.path.join('.')}: ${iss.message}`).join('; ')}`);
    return null;
  });
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function contentFromCard(card: GeneratedCard) {
  const correct = card.correct;
  const correctIndices = Array.isArray(correct) ? correct : [correct];
  return card.type === 'multiple_select'
    ? {
        question: card.question,
        options: card.options,
        correct: correctIndices,
        requiredCount: card.requiredCount ?? correctIndices.length,
        explanation: card.explanation,
        distractorExplanations: card.distractorExplanations,
      }
    : {
        question: card.question,
        options: card.options,
        correct: correctIndices[0],
        explanation: card.explanation,
        distractorExplanations: card.distractorExplanations,
      };
}

function findIssues(card: GeneratedCard, content: ReturnType<typeof contentFromCard>): string[] {
  const issues = checkCardConsistency(content as any, card.type);
  if (card.options.length !== 4) issues.push(`expected exactly 4 options, got ${card.options.length}`);
  return issues;
}

type PassResult = { slot: Slot; card: GeneratedCard | null; issues: string[] };

async function runPass(slots: Slot[]): Promise<PassResult[]> {
  const batches = chunk(slots, BATCH_SIZE);
  const results: PassResult[] = [];

  for (const [i, batch] of batches.entries()) {
    console.log(`  Batch ${i + 1}/${batches.length} (${batch.length} cards)...`);

    let generated: (GeneratedCard | null)[];
    try {
      generated = await generateBatch(batch);
    } catch (err) {
      console.log(`    BATCH FAILED (${err instanceof Error ? err.message : String(err)}) — all ${batch.length} card(s) in this batch will retry.`);
      generated = batch.map(() => null);
    }

    if (generated.length !== batch.length) {
      console.log(`    NOTE: requested ${batch.length}, model returned ${generated.length} — matched by position.`);
    }

    for (let j = 0; j < batch.length; j++) {
      const slot = batch[j];
      const card = generated[j] ?? null;
      if (!card) {
        results.push({ slot, card: null, issues: ['generation parse failure'] });
        continue;
      }
      const issues = findIssues(card, contentFromCard(card));
      results.push({ slot, card, issues });
    }
  }

  return results;
}

const MAX_ATTEMPTS = 3;

async function main() {
  const db = getDb();
  const user = await getCurrentUser();

  const initialSlots = buildSlots();
  console.log(`Generating ${initialSlots.length} new ${DOMAIN} card(s)...`);

  let approvedCount = 0;
  let currentSlots = initialSlots;
  const lastAttempt = new Map<Slot, PassResult>();

  for (let attempt = 1; attempt <= MAX_ATTEMPTS && currentSlots.length > 0; attempt++) {
    console.log(`\nAttempt ${attempt}/${MAX_ATTEMPTS}: ${currentSlots.length} card(s)...`);
    const results = await runPass(currentSlots);
    const stillFailing: Slot[] = [];

    for (const result of results) {
      const { slot, card, issues } = result;
      lastAttempt.set(slot, result);

      if (card && issues.length === 0) {
        await db.insert(cards).values({
          userId: user.id,
          domain: DOMAIN,
          topic: card.topic,
          type: card.type,
          content: contentFromCard(card),
          status: 'active',
          sourceType: 'generated',
          authoredDifficulty: card.authoredDifficulty,
          objective: slot.objective,
        });
        approvedCount++;
        lastAttempt.delete(slot);
      } else {
        stillFailing.push(slot);
      }
    }

    currentSlots = stillFailing;
  }

  let flaggedCount = 0;
  let genFailedCount = 0;
  for (const slot of currentSlots) {
    const result = lastAttempt.get(slot);
    if (result?.card) {
      await db.insert(cards).values({
        userId: user.id,
        domain: DOMAIN,
        topic: result.card.topic,
        type: result.card.type,
        content: contentFromCard(result.card),
        status: 'pending',
        sourceType: 'generated',
        authoredDifficulty: result.card.authoredDifficulty,
        objective: slot.objective,
      });
      flaggedCount++;
      console.log(`\nFLAGGED after ${MAX_ATTEMPTS} attempts (left pending): objective ${slot.objective} / ${slot.hint}`);
      for (const issue of result.issues) console.log(`  - ${issue}`);
    } else {
      genFailedCount++;
      console.log(`\nGENERATION FAILED after ${MAX_ATTEMPTS} attempts (nothing inserted): objective ${slot.objective} / ${slot.hint}`);
    }
  }

  console.log(`\nDone. Auto-approved ${approvedCount}, flagged for review ${flaggedCount}, generation failures ${genFailedCount}.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
