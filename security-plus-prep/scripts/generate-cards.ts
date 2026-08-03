import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { getDb } from '../src/db';
import { cards } from '../src/db/schema';
import { getCurrentUser } from '../src/lib/auth';

const MODEL = 'claude-sonnet-5';
const BATCH_SIZE = 6;

const client = new Anthropic();

// Per-domain new-card counts sized so the pool hits official SY0-701
// weights at 250 total cards (135 legacy + 115 new). General Security
// Concepts gets 0 — it's already over target and stays untouched.
const DOMAIN_PLAN: { domain: string; total: number }[] = [
  { domain: 'Security Operations', total: 44 },
  { domain: 'Threats, Vulnerabilities, & Mitigations', total: 21 },
  { domain: 'Security Program Management and Oversight', total: 30 },
  { domain: 'Security Architecture', total: 20 },
];

const MS_SHARE = 0.4; // ~40% of new cards are multiple_select
const DIFFICULTY_SHARE = { recall: 0.2, application: 0.55, analysis: 0.25 } as const;

type Difficulty = 'recall' | 'application' | 'analysis';
type Slot = {
  domain: string;
  type: 'multiple_choice' | 'multiple_select';
  difficulty: Difficulty;
  requiredCount?: number;
};

function splitCounts(total: number, shares: Record<string, number>): Record<string, number> {
  const keys = Object.keys(shares);
  const raw = keys.map((k) => ({ k, v: total * shares[k] }));
  const counts: Record<string, number> = {};
  let assigned = 0;
  for (const { k, v } of raw) {
    counts[k] = Math.round(v);
    assigned += counts[k];
  }
  // Fix rounding drift against the last key so counts sum to `total` exactly.
  counts[keys[keys.length - 1]] += total - assigned;
  return counts;
}

function buildSlotsForDomain(domain: string, total: number): Slot[] {
  const { multiple_select: msCount, multiple_choice: mcCount } = splitCounts(total, {
    multiple_choice: 1 - MS_SHARE,
    multiple_select: MS_SHARE,
  });
  const difficultyCounts = splitCounts(total, DIFFICULTY_SHARE);
  const difficulties: Difficulty[] = [
    ...Array(difficultyCounts.recall).fill('recall'),
    ...Array(difficultyCounts.application).fill('application'),
    ...Array(difficultyCounts.analysis).fill('analysis'),
  ];

  const slots: Slot[] = [];
  for (let i = 0; i < total; i++) {
    const type = i < mcCount ? 'multiple_choice' : 'multiple_select';
    const difficulty = difficulties[i % difficulties.length];
    slots.push({
      domain,
      type,
      difficulty,
      requiredCount: type === 'multiple_select' ? (i % 3 === 0 ? 3 : 2) : undefined,
    });
  }
  return slots;
}

function buildFullSlotPlan(): Slot[] {
  return DOMAIN_PLAN.flatMap((d) => buildSlotsForDomain(d.domain, d.total));
}

function buildSampleSlots(): Slot[] {
  // 4 domains x both types = 8, spanning difficulty tiers.
  const difficulties: Difficulty[] = ['recall', 'application', 'analysis', 'application'];
  return DOMAIN_PLAN.flatMap((d, i) => [
    { domain: d.domain, type: 'multiple_choice' as const, difficulty: difficulties[i] },
    { domain: d.domain, type: 'multiple_select' as const, difficulty: difficulties[(i + 1) % 4], requiredCount: 2 },
  ]);
}

const GeneratedCardSchema = z.object({
  domain: z.string(),
  type: z.enum(['multiple_choice', 'multiple_select']),
  topic: z.string(),
  objective: z.string(),
  authoredDifficulty: z.enum(['recall', 'application', 'analysis']),
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
  description: 'Submit a batch of generated CompTIA Security+ (SY0-701) practice questions.',
  input_schema: {
    type: 'object',
    properties: {
      cards: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            domain: { type: 'string' },
            type: { type: 'string', enum: ['multiple_choice', 'multiple_select'] },
            topic: { type: 'string', description: 'Short topic label, 2-5 words' },
            objective: { type: 'string', description: "SY0-701 exam objective number, e.g. '2.4'" },
            authoredDifficulty: { type: 'string', enum: ['recall', 'application', 'analysis'] },
            question: { type: 'string' },
            options: { type: 'array', items: { type: 'string' } },
            correct: {
              description: 'Index into options for multiple_choice, array of indices for multiple_select',
              oneOf: [{ type: 'integer' }, { type: 'array', items: { type: 'integer' } }],
            },
            requiredCount: { type: 'integer', description: 'multiple_select only: how many options must be picked' },
            explanation: { type: 'string', description: 'Why the correct answer is correct' },
            distractorExplanations: {
              type: 'array',
              items: { type: 'string' },
              description: 'One entry per option, same order. Empty string for correct option(s).',
            },
          },
          required: ['domain', 'type', 'topic', 'objective', 'authoredDifficulty', 'question', 'options', 'correct', 'explanation', 'distractorExplanations'],
        },
      },
    },
    required: ['cards'],
  },
};

function buildPrompt(slots: Slot[]): string {
  const spec = slots
    .map((s, i) => {
      const parts = [`${i + 1}. domain: "${s.domain}"`, `type: ${s.type}`, `authoredDifficulty: ${s.difficulty}`];
      if (s.type === 'multiple_select') parts.push(`requiredCount: ${s.requiredCount}`);
      return parts.join(', ');
    })
    .join('\n');

  return `Generate ${slots.length} original CompTIA Security+ (SY0-701) practice questions, one per spec below. Follow every spec exactly (domain, type, difficulty).

STYLE — every question, by default, is scenario-style:
- 2-4 sentences of realistic situation (a company, an analyst, an incident, a design decision), then a question ending in BEST / MOST LIKELY / FIRST / MOST cost-effective (vary which one).
- "recall" difficulty: shorter scenario, more direct question — but still scenario-framed, not a bare definition lookup.
- "application" difficulty: scenario requires applying a concept to a specific situation.
- "analysis" difficulty: scenario requires weighing multiple plausible options against situational constraints.

DISTRACTORS — this is the highest-value part, do not skimp on it:
- Every wrong option must be a REAL, valid security control or concept that would be correct in a DIFFERENT scenario — never an obviously-wrong or nonsensical option. Wrong here means "wrong in THIS context," not "wrong in general."
- distractorExplanations must say specifically why that real control doesn't fit this scenario — not a generic restatement of the correct answer.

multiple_select questions: the question text MUST end with "(Choose ${'{requiredCount}'}.)" matching the spec's requiredCount exactly (e.g. "(Choose two.)" or "(Choose three.)"). correct must be an array with exactly requiredCount indices.

objective: assign the real SY0-701 exam objective number (e.g. "1.2", "3.4", "4.7") that this question maps to within its domain — use your knowledge of the official SY0-701 objectives list.

topic: a short 2-5 word label for this specific question's subtopic.

Specs:
${spec}

Call submit_cards with exactly ${slots.length} entries, in the same order as the specs above.`;
}

async function generateBatch(slots: Slot[]): Promise<GeneratedCard[]> {
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

  return BatchResultSchema.parse(toolUse.input).cards;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function printCard(card: GeneratedCard) {
  console.log(`\n--- [${card.domain}] ${card.topic} (obj ${card.objective}, ${card.authoredDifficulty}, ${card.type})`);
  console.log(`Q: ${card.question}`);
  card.options.forEach((opt, idx) => {
    const correctIndices = Array.isArray(card.correct) ? card.correct : [card.correct];
    const marker = correctIndices.includes(idx) ? '(correct)' : '(wrong)';
    console.log(`  ${idx} ${marker}: ${opt}`);
    if (!correctIndices.includes(idx)) {
      console.log(`     -> ${card.distractorExplanations[idx] ?? '(missing)'}`);
    }
  });
  console.log(`Explanation: ${card.explanation}`);
}

async function main() {
  const sampleArg = process.argv.includes('--sample');
  const slots = sampleArg ? buildSampleSlots() : buildFullSlotPlan();

  console.log(`Generating ${slots.length} card(s)${sampleArg ? ' (SAMPLE — not written to DB)' : ''}...`);

  const db = getDb();
  const user = await getCurrentUser();
  const batches = chunk(slots, BATCH_SIZE);
  let total = 0;

  for (const [i, batch] of batches.entries()) {
    console.log(`Batch ${i + 1}/${batches.length} (${batch.length} cards)...`);
    const generated = await generateBatch(batch);

    for (const card of generated) {
      if (sampleArg) {
        printCard(card);
        continue;
      }

      const correct = card.correct;
      const content =
        card.type === 'multiple_select'
          ? {
              question: card.question,
              options: card.options,
              correct: Array.isArray(correct) ? correct : [correct],
              requiredCount: card.requiredCount ?? (Array.isArray(correct) ? correct.length : 1),
              explanation: card.explanation,
              distractorExplanations: card.distractorExplanations,
            }
          : {
              question: card.question,
              options: card.options,
              correct: Array.isArray(correct) ? correct[0] : correct,
              explanation: card.explanation,
              distractorExplanations: card.distractorExplanations,
            };

      await db.insert(cards).values({
        userId: user.id,
        domain: card.domain,
        topic: card.topic,
        type: card.type,
        content,
        status: 'pending',
        sourceType: 'generated',
        authoredDifficulty: card.authoredDifficulty,
        objective: card.objective,
      });
      total++;
    }
  }

  if (sampleArg) {
    console.log('\nSample complete — nothing written to the database.');
  } else {
    console.log(`\nInserted ${total} pending card(s). Run scripts/review-new-cards.ts to approve.`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
