// Rewrites the 135 legacy manual-seed cards into exam-realistic,
// scenario-based BEST-answer questions. Each rewrite preserves the
// original card's concept, domain, and topic but discards its wording
// entirely — legacy cards are bare definition lookups ("RBAC assigns
// permissions to:"); real SY0-701 questions bury the same concept in a
// 2-4 sentence scenario where multiple options are plausible and only one
// is BEST by CompTIA's logic.
//
// Pipeline: generate in batches -> insert as pending, source_type
// 'rewritten-legacy', source_ref = original card id -> run the existing
// structural consistency check -> on pass, flip the rewrite to 'active'
// and the original to 'archived' (never deleted, in case a rewrite is
// worse) -> on fail, leave the rewrite 'pending' and the original
// untouched for manual follow-up.
//
// Usage:
//   npx dotenv-cli -e .env -- tsx scripts/rewrite-legacy-cards.ts --sample
//   npx dotenv-cli -e .env -- tsx scripts/rewrite-legacy-cards.ts

import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { and, eq, inArray } from 'drizzle-orm';
import { getDb } from '../src/db';
import { cards } from '../src/db/schema';
import { getCurrentUser } from '../src/lib/auth';
import { AI_MODELS } from '../src/lib/ai-models';
import { checkCardConsistency } from './check-card-consistency';

const MODEL = AI_MODELS.content;
const BATCH_SIZE = 5;
const MS_SHARE = 0.25; // ~25% of rewrites become multiple_select, per spec

const client = new Anthropic();

type LegacyCard = typeof cards.$inferSelect;
type LegacyContent = { question: string; options: string[]; correct: number; explanation: string };

const QUALIFIERS = ['BEST', 'MOST likely', 'FIRST', 'MOST cost-effective', 'GREATEST risk'] as const;
type Qualifier = (typeof QUALIFIERS)[number];

// Topics where getting the ORDER of steps right is the actual skill being
// tested (incident response, forensics chain of custody, DR/BC failover,
// change control) get FIRST assigned much more often than the round-robin
// would give them on its own.
const SEQUENCE_TOPICS = new Set(['Incident Response', 'Forensics', 'Disaster Recovery', 'Business Continuity', 'Change Management']);

type LengthTier = 'short' | 'full';

type Slot = {
  original: LegacyCard;
  type: 'multiple_choice' | 'multiple_select';
  requiredCount?: number;
  qualifier: Qualifier;
  lengthTier: LengthTier;
};

// Known-good, hand-picked spread across all 5 domains (one forced to
// multiple_select) so a single sample batch demonstrates every required
// shape: scenario length, qualifier variety, and the "(Choose two.)" format.
const SAMPLE_IDS = [
  'e607e438-286c-455e-a422-a32655cc86b3', // General Security Concepts / Access Control Models (RBAC)
  'ffbb3104-0ef2-42ae-aad4-3fa1deceef6f', // Threats, Vulnerabilities, & Mitigations / Denial of Service (SYN flood)
  'b9ea0851-c4c9-4684-ae0e-2fc5ad014297', // Security Operations / Disaster Recovery (RTO)
  '38316972-f3c1-4c60-b662-9a74a6622c4b', // Security Architecture / Zero Trust Architecture -> multiple_select
  'daf3bac0-7c42-4c12-9091-0e1b0c7847cb', // Security Program Management and Oversight / Risk Management (risk transfer)
];
const SAMPLE_MS_ID = '38316972-f3c1-4c60-b662-9a74a6622c4b';

// Qualifier assignment: sequence-sensitive topics get FIRST (occasionally
// GREATEST risk for variety) most of the time; everything else round-robins
// across all 5 qualifiers so BEST doesn't dominate the batch.
function assignQualifier(topic: string, indexInTopic: number, indexOverall: number): Qualifier {
  if (SEQUENCE_TOPICS.has(topic)) {
    return indexInTopic % 3 === 2 ? 'GREATEST risk' : 'FIRST';
  }
  return QUALIFIERS[indexOverall % QUALIFIERS.length];
}

// ~1/3 short (1-2 sentences or a direct one-liner), ~2/3 full scenario —
// real exam questions aren't all 4-sentence scenarios, and a rigid format
// would let candidates pattern-match on length instead of reading content.
function assignLengthTier(indexOverall: number): LengthTier {
  return indexOverall % 3 === 0 ? 'short' : 'full';
}

// Deterministic ~25% multi-select assignment over the full 135, stable
// under re-runs regardless of DB fetch order.
function assignTypes(originals: LegacyCard[]): Slot[] {
  const sorted = [...originals].sort((a, b) => a.id.localeCompare(b.id));
  const topicCounters = new Map<string, number>();
  return sorted.map((original, i) => {
    const isMs = i % 4 === 3; // 1 in 4 => 25%
    const topicIndex = topicCounters.get(original.topic) ?? 0;
    topicCounters.set(original.topic, topicIndex + 1);
    return {
      original,
      type: isMs ? ('multiple_select' as const) : ('multiple_choice' as const),
      requiredCount: isMs ? (i % 8 === 3 ? 3 : 2) : undefined,
      qualifier: assignQualifier(original.topic, topicIndex, i),
      lengthTier: assignLengthTier(i),
    };
  });
}

function buildSampleSlots(originals: LegacyCard[]): Slot[] {
  return SAMPLE_IDS.map((id, i) => {
    const original = originals.find((c) => c.id === id);
    if (!original) throw new Error(`Sample card ${id} not found — was it already rewritten/archived?`);
    const isMs = id === SAMPLE_MS_ID;
    return {
      original,
      type: isMs ? ('multiple_select' as const) : ('multiple_choice' as const),
      requiredCount: isMs ? 2 : undefined,
      qualifier: QUALIFIERS[i % QUALIFIERS.length],
      lengthTier: assignLengthTier(i),
    };
  });
}

const RewrittenCardSchema = z.object({
  type: z.enum(['multiple_choice', 'multiple_select']),
  objective: z.string(),
  authoredDifficulty: z.enum(['application', 'analysis']),
  question: z.string(),
  options: z.array(z.string()),
  correct: z.union([z.number(), z.array(z.number())]),
  requiredCount: z.number().optional(),
  explanation: z.string(),
  distractorExplanations: z.array(z.string()),
});
const BatchResultSchema = z.object({ cards: z.array(RewrittenCardSchema) });
type RewrittenCard = z.infer<typeof RewrittenCardSchema>;

const submitCardsTool: Anthropic.Tool = {
  name: 'submit_cards',
  description: 'Submit a batch of rewritten CompTIA Security+ (SY0-701) practice questions.',
  input_schema: {
    type: 'object',
    properties: {
      cards: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['multiple_choice', 'multiple_select'] },
            objective: { type: 'string', description: "SY0-701 exam objective number, e.g. '2.4'" },
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
          required: ['type', 'objective', 'authoredDifficulty', 'question', 'options', 'correct', 'explanation', 'distractorExplanations'],
        },
      },
    },
    required: ['cards'],
  },
};

function buildPrompt(slots: Slot[]): string {
  const spec = slots
    .map((s, i) => {
      const o = s.original.content as LegacyContent;
      const correctAnswer = o.options[o.correct];
      const lines = [
        `${i + 1}. domain: "${s.original.domain}", topic: "${s.original.topic}", type: ${s.type}`,
        `   qualifier: ${s.qualifier}`,
        `   length: ${s.lengthTier}`,
        s.type === 'multiple_select' ? `   requiredCount: ${s.requiredCount}` : null,
        `   concept to preserve (context only — do NOT reuse this wording): original question "${o.question}", correct answer "${correctAnswer}", because: ${o.explanation}`,
      ].filter(Boolean);
      return lines.join('\n');
    })
    .join('\n\n');

  return `Rewrite ${slots.length} CompTIA Security+ (SY0-701) practice questions. Each rewrite must test the SAME underlying concept as the original listed below, in the SAME domain — but as a completely new, exam-realistic scenario question. Do not reuse the original's wording, phrasing, or scenario framing.

WHY THIS MATTERS: candidate feedback on the real SY0-701 exam consistently says the hard part isn't obscure facts — it's that multiple options all look correct, and you must pick the BEST one by CompTIA's logic. These rewrites must recreate that difficulty, not test rote recall.

EVERY QUESTION — including multiple_select — has EXACTLY 4 options TOTAL. Never 5, never 6. options.length === 4 always. This is non-negotiable and has been a source of bugs: for a multiple_select card with requiredCount 2, that means exactly 2 correct + 2 incorrect = 4 total, not 2 correct + 3 incorrect.

EVERY QUESTION:
- Each spec below carries its own "qualifier" and "length" — follow BOTH exactly as assigned, do not substitute your own choice or default to BEST/full-scenario. Across the batch as a whole these are already balanced (qualifiers spread across BEST / MOST likely / FIRST / MOST cost-effective / GREATEST risk; lengths spread across short/full) — your job is to hit the assignment for each individual spec, not to re-balance it yourself.
- length "full": 2-4 sentences of realistic organizational scenario (a company, a role, a constraint, an incident in progress) before the question itself.
- length "short": 0-2 sentences of setup — even a direct, compact one-line question is fine here. Real exam questions aren't all elaborate scenarios; a short item should still test the same judgment (plausible distractors, a real qualifier), just without the extended narrative framing.
- qualifier "FIRST": the question is about sequence/priority — "what should be done FIRST" — and at least two options must be real, later-but-still-correct steps in the same process, not just wrong actions. This is especially important for incident response, forensics, and DR/BC/change-management topics, where getting the order right is the actual skill being tested.
- End every question with its assigned qualifier, worded naturally (e.g. "Which of the following is the FIRST step..." / "...the MOST cost-effective solution?" / "...poses the GREATEST risk?"). For multiple_select, phrase around selecting multiple (e.g. "Which TWO of the following...") while still ending on the assigned qualifier where it fits naturally.
- All 4 options must be real, plausible, legitimate security controls or concepts — never a throwaway or nonsensical distractor. For multiple_choice: at least TWO of the four must be genuinely defensible responses to the scenario; only ONE is the BEST answer. For multiple_select: exactly requiredCount are correct, and the remaining (4 - requiredCount) are plausible-but-inferior in the same grounded way.

multiple_select DISTRACTOR QUALITY — this is exactly where generated "Choose two/three" questions tend to go weak: every wrong option must be a legitimate, real-world control a competent practitioner might genuinely reach for — plausible in general, wrong ONLY because of a specific detail in THIS scenario (wrong layer, wrong phase, wrong scope, wrong cost tier, solves a different risk). If a wrong option could be eliminated just by recognizing it's not a real or sensible control — without needing to read the scenario at all — rewrite it. A test-taker should need to understand the scenario to eliminate every wrong option, never just skim the option list and spot the silly ones.

DISTRACTOR EXPLANATIONS — the highest-value part, do not skimp:
- EVERY wrong option, no exceptions, gets a real, specific, non-empty explanation written out in full.
- Each one must say SPECIFICALLY why it is worse in THIS scenario, not merely "wrong" or a restatement of the correct answer. Ground each one in something concrete: wrong phase/sequence ("a correct control, but the wrong step in incident response order"), treats a symptom instead of the root cause, fails a specific constraint stated in the scenario (cost, time, scope, regulatory), or is a real control that solves a different, adjacent problem than the one described.
- The top-level 'explanation' field must be genuine prose, written out in full, explaining why the correct answer(s) are BEST.

distractorExplanations ARRAY ALIGNMENT — this has been a source of bugs, follow it exactly:
- distractorExplanations must have EXACTLY the same length as options (4), one entry per option, in the SAME ORDER as options — do not build it by skipping the correct option and only listing the wrong ones. A 4-option card gets a 4-entry distractorExplanations array, always, never 3.
- The entry at each correct index (single index for multiple_choice, every index in correct[] for multiple_select) must be the empty string "".
- Every other index must have a non-empty, option-specific explanation.
- Before finalizing each card, verify: len(distractorExplanations) === len(options) === 4, and distractorExplanations[i] === "" if and only if i is a correct index.

multiple_select cards: the question text MUST end with "(Choose ${'{requiredCount}'}.)" matching the spec's requiredCount exactly (e.g. "(Choose two.)"). correct must be an array with exactly requiredCount indices, options must still have exactly 4 entries total.

objective: assign the real SY0-701 exam objective number (e.g. "1.2", "3.4", "4.7") this question maps to.
authoredDifficulty: "application" or "analysis" only — never "recall". These are judgment calls, not fact lookups, so do not include a mnemonic.

Specs (concept context only — do not reuse wording):
${spec}

Call submit_cards with exactly ${slots.length} entries, in the same order as the specs above.`;
}

// Parses each card independently instead of the whole batch as one Zod
// object, so one malformed card (missing field, wrong type) doesn't throw
// away — or crash the run on — the other 4 good cards in the same batch.
// A null in the returned array means that slot's generation failed and
// needs a retry; it is never silently treated as success.
async function generateBatch(slots: Slot[]): Promise<(RewrittenCard | null)[]> {
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
    const parsed = RewrittenCardSchema.safeParse(raw);
    if (parsed.success) return parsed.data;
    console.log(`  GENERATION PARSE FAILURE for slot ${i} (${slots[i]?.original.domain} / ${slots[i]?.original.topic}):`);
    console.log(`    ${parsed.error.issues.map((iss) => `${iss.path.join('.')}: ${iss.message}`).join('; ')}`);
    return null;
  });
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function printCard(original: LegacyCard, card: RewrittenCard) {
  console.log(`\n=== [${original.domain}] ${original.topic} (obj ${card.objective}, ${card.authoredDifficulty}, ${card.type}) ===`);
  console.log(`Originally: "${(original.content as LegacyContent).question}"`);
  console.log(`\nQ: ${card.question}`);
  const correctIndices = Array.isArray(card.correct) ? card.correct : [card.correct];
  card.options.forEach((opt, idx) => {
    const marker = correctIndices.includes(idx) ? '(BEST)' : '(worse)';
    console.log(`  ${idx} ${marker}: ${opt}`);
    if (!correctIndices.includes(idx)) {
      console.log(`     -> ${card.distractorExplanations[idx] ?? '(missing)'}`);
    }
  });
  console.log(`Why BEST: ${card.explanation}`);
}

function contentFromCard(card: RewrittenCard) {
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

function findIssues(card: RewrittenCard, content: ReturnType<typeof contentFromCard>): string[] {
  const issues = checkCardConsistency(content as any, card.type);
  if (card.options.length !== 4) issues.push(`expected exactly 4 options for a rewrite, got ${card.options.length}`);
  return issues;
}

type PassResult = { slot: Slot; card: RewrittenCard | null; issues: string[] };

// One generation pass over a list of slots. Never writes to the DB itself
// — the caller decides what to do with successes (insert+archive) and
// failures (retry, or give up and record for review) so retries never
// leave orphaned draft rows behind.
async function runPass(slots: Slot[]): Promise<PassResult[]> {
  const batches = chunk(slots, BATCH_SIZE);
  const results: PassResult[] = [];

  for (const [i, batch] of batches.entries()) {
    console.log(`  Batch ${i + 1}/${batches.length} (${batch.length} cards)...`);

    let generated: (RewrittenCard | null)[];
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
  const sampleArg = process.argv.includes('--sample');
  const db = getDb();

  const originals = await db.select().from(cards).where(and(eq(cards.sourceType, 'manual-seed'), eq(cards.status, 'active')));
  console.log(`Found ${originals.length} legacy cards eligible for rewrite.`);

  const initialSlots = sampleArg ? buildSampleSlots(originals) : assignTypes(originals);
  console.log(`Rewriting ${initialSlots.length} card(s)${sampleArg ? ' (SAMPLE — not written to DB)' : ''}...`);

  if (sampleArg) {
    const results = await runPass(initialSlots);
    for (const { slot, card, issues } of results) {
      if (!card) {
        console.log(`\n=== [${slot.original.domain}] ${slot.original.topic}: GENERATION PARSE FAILURE ===`);
        continue;
      }
      printCard(slot.original, card);
      if (issues.length > 0) {
        console.log(`  *** WOULD FAIL CONSISTENCY CHECK ***`);
        for (const issue of issues) console.log(`    - ${issue}`);
      }
    }
    return;
  }

  const user = await getCurrentUser();

  let approvedCount = 0;
  let currentSlots = initialSlots;
  const lastAttempt = new Map<string, PassResult>(); // original.id -> most recent attempt, for the final give-up insert

  for (let attempt = 1; attempt <= MAX_ATTEMPTS && currentSlots.length > 0; attempt++) {
    console.log(`\nAttempt ${attempt}/${MAX_ATTEMPTS}: ${currentSlots.length} card(s)...`);
    const results = await runPass(currentSlots);
    const stillFailing: Slot[] = [];

    for (const result of results) {
      const { slot, card, issues } = result;
      lastAttempt.set(slot.original.id, result);

      if (card && issues.length === 0) {
        const content = contentFromCard(card);
        const [inserted] = await db
          .insert(cards)
          .values({
            userId: user.id,
            domain: slot.original.domain,
            topic: slot.original.topic,
            type: card.type,
            content,
            status: 'active',
            sourceType: 'rewritten-legacy',
            sourceRef: slot.original.id,
            authoredDifficulty: card.authoredDifficulty,
            objective: card.objective,
          })
          .returning();
        await db.update(cards).set({ status: 'archived' }).where(eq(cards.id, slot.original.id));
        approvedCount++;
        lastAttempt.delete(slot.original.id); // succeeded — no need to remember a failed attempt
      } else {
        stillFailing.push(slot);
      }
    }

    currentSlots = stillFailing;
  }

  let flaggedCount = 0;
  let genFailedCount = 0;
  for (const slot of currentSlots) {
    const result = lastAttempt.get(slot.original.id);
    if (result?.card) {
      const content = contentFromCard(result.card);
      await db.insert(cards).values({
        userId: user.id,
        domain: slot.original.domain,
        topic: slot.original.topic,
        type: result.card.type,
        content,
        status: 'pending',
        sourceType: 'rewritten-legacy',
        sourceRef: slot.original.id,
        authoredDifficulty: result.card.authoredDifficulty,
        objective: result.card.objective,
      });
      flaggedCount++;
      console.log(`\nFLAGGED after ${MAX_ATTEMPTS} attempts (left pending, original untouched): ${slot.original.domain} / ${slot.original.topic}`);
      for (const issue of result.issues) console.log(`  - ${issue}`);
    } else {
      genFailedCount++;
      console.log(`\nGENERATION FAILED after ${MAX_ATTEMPTS} attempts (original untouched, nothing inserted): ${slot.original.domain} / ${slot.original.topic}`);
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
