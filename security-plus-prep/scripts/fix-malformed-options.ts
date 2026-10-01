// One-off remediation for the 2 cards scripts/audit-malformed-options.ts
// found with a phantom bare-number option (a legitimate 4-option question
// plus a 5th option that's literally the string "1"). Both are from the
// original generate-cards.ts batch, predate the "exactly 4 options" and
// "never recall" rules the later pipelines enforce, and are hardcoded
// here deliberately — this fixes exactly the two cards the audit found,
// not a general "find and fix" sweep.
//
// Same pattern as scripts/rewrite-legacy-cards.ts: generate a clean
// replacement preserving domain/topic/objective/concept, run it through
// the structural consistency check, archive the original only once the
// replacement passes (retry up to 3 attempts; never approve on a fail).
//
// Usage: npx dotenv-cli -e .env -- tsx scripts/fix-malformed-options.ts

import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { eq, inArray } from 'drizzle-orm';
import { getDb } from '../src/db';
import { cards } from '../src/db/schema';
import { getCurrentUser } from '../src/lib/auth';
import { AI_MODELS } from '../src/lib/ai-models';
import { checkCardConsistency } from './check-card-consistency';

const MODEL = AI_MODELS.content;
const MAX_ATTEMPTS = 3;

const BROKEN_CARD_IDS = ['34008ce4-e513-42eb-9e2a-2eb2975bdf22', 'f65a2da7-2570-41e5-987c-235909e05247'];

const client = new Anthropic();

type BrokenCard = typeof cards.$inferSelect;
type LegacyContent = { question: string; options: string[]; correct: number; explanation: string };

const RewrittenCardSchema = z.object({
  authoredDifficulty: z.enum(['application', 'analysis']),
  question: z.string(),
  options: z.array(z.string()),
  correct: z.number(),
  explanation: z.string(),
  distractorExplanations: z.array(z.string()),
});
type RewrittenCard = z.infer<typeof RewrittenCardSchema>;

const submitCardsTool: Anthropic.Tool = {
  name: 'submit_cards',
  description: 'Submit clean replacement CompTIA Security+ (SY0-701) practice questions.',
  input_schema: {
    type: 'object',
    properties: {
      cards: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            authoredDifficulty: { type: 'string', enum: ['application', 'analysis'] },
            question: { type: 'string' },
            options: { type: 'array', items: { type: 'string' } },
            correct: { type: 'integer', description: 'Index into options' },
            explanation: { type: 'string' },
            distractorExplanations: {
              type: 'array',
              items: { type: 'string' },
              description: 'MUST have exactly options.length entries, same order as options. "" at the correct index, a context-specific reason everywhere else.',
            },
          },
          required: ['authoredDifficulty', 'question', 'options', 'correct', 'explanation', 'distractorExplanations'],
        },
      },
    },
    required: ['cards'],
  },
};

function buildPrompt(broken: BrokenCard[]): string {
  const spec = broken
    .map((card, i) => {
      const c = card.content as LegacyContent;
      return [
        `${i + 1}. domain: "${card.domain}", topic: "${card.topic}", SY0-701 objective ${card.objective}`,
        `   concept to preserve (context only — do NOT reuse this wording): original question "${c.question}", correct answer "${c.options[c.correct]}"`,
      ].join('\n');
    })
    .join('\n\n');

  return `Rewrite ${broken.length} CompTIA Security+ (SY0-701) practice question(s). Each must test the SAME underlying concept as the original below, in the SAME domain, as a completely new scenario-based multiple_choice question. Do not reuse the original's wording.

CONTEXT: the original card had a data bug — a phantom 5th option that was just the literal string "1" instead of real text. This rewrite must produce exactly 4 clean, real options with no trace of that bug.

EVERY QUESTION has EXACTLY 4 options. Never 5, never 6, never a bare number or placeholder string. options.length === 4 always.

- 2-4 sentences of realistic organizational scenario before the question, ending with a natural qualifier (BEST / MOST likely / FIRST / MOST cost-effective / GREATEST risk — pick whichever fits the concept).
- All 4 options must be real, plausible, legitimate security controls or concepts — never a throwaway or nonsensical distractor. At least TWO of the four must be genuinely defensible responses; only ONE is the BEST answer.
- Every wrong option's distractorExplanation must say specifically why it's worse in THIS scenario, not merely wrong.

distractorExplanations ARRAY ALIGNMENT — this has been a source of bugs, follow it exactly:
- distractorExplanations must have EXACTLY 4 entries, one per option, in the SAME ORDER as options.
- The entry at the correct index must be the empty string "".
- Every other index must have a non-empty, option-specific explanation.
- Before finalizing, verify: len(distractorExplanations) === len(options) === 4, and distractorExplanations[i] === "" if and only if i === correct.

authoredDifficulty: "application" or "analysis" only — never "recall". This is a judgment call, not a fact lookup, so do not include a mnemonic.

Specs (concept context only — do not reuse wording):
${spec}

Call submit_cards with exactly ${broken.length} entries, in the same order as the specs above.`;
}

async function generateBatch(broken: BrokenCard[]): Promise<(RewrittenCard | null)[]> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    tools: [submitCardsTool],
    tool_choice: { type: 'tool', name: 'submit_cards' },
    messages: [{ role: 'user', content: buildPrompt(broken) }],
  });

  const toolUse = response.content.find((block): block is Anthropic.ToolUseBlock => block.type === 'tool_use');
  if (!toolUse) throw new Error('No tool_use block in response');

  const rawCardsField = (toolUse.input as { cards?: unknown })?.cards;
  const rawCards = Array.isArray(rawCardsField) ? rawCardsField : [];
  return rawCards.map((raw, i) => {
    const parsed = RewrittenCardSchema.safeParse(raw);
    if (parsed.success) return parsed.data;
    console.log(`  PARSE FAILURE for slot ${i}: ${parsed.error.issues.map((iss) => `${iss.path.join('.')}: ${iss.message}`).join('; ')}`);
    return null;
  });
}

function contentFromCard(card: RewrittenCard) {
  return {
    question: card.question,
    options: card.options,
    correct: card.correct,
    explanation: card.explanation,
    distractorExplanations: card.distractorExplanations,
  };
}

function findIssues(card: RewrittenCard, content: ReturnType<typeof contentFromCard>): string[] {
  const issues = checkCardConsistency(content as any, 'multiple_choice');
  if (card.options.length !== 4) issues.push(`expected exactly 4 options, got ${card.options.length}`);
  return issues;
}

async function main() {
  const db = getDb();
  const user = await getCurrentUser();

  const broken = await db.select().from(cards).where(inArray(cards.id, BROKEN_CARD_IDS));
  if (broken.length !== BROKEN_CARD_IDS.length) {
    console.log(`WARNING: expected ${BROKEN_CARD_IDS.length} cards, found ${broken.length}. Proceeding with what's found.`);
  }
  console.log(`Regenerating ${broken.length} card(s)...`);

  let currentCards = broken;
  const lastCard = new Map<string, RewrittenCard | null>();

  for (let attempt = 1; attempt <= MAX_ATTEMPTS && currentCards.length > 0; attempt++) {
    console.log(`\nAttempt ${attempt}/${MAX_ATTEMPTS}: ${currentCards.length} card(s)...`);
    const generated = await generateBatch(currentCards);
    const stillFailing: BrokenCard[] = [];

    for (let i = 0; i < currentCards.length; i++) {
      const original = currentCards[i];
      const card = generated[i] ?? null;
      lastCard.set(original.id, card);

      if (!card) {
        stillFailing.push(original);
        continue;
      }
      const issues = findIssues(card, contentFromCard(card));
      if (issues.length > 0) {
        console.log(`  FAILED consistency check for ${original.topic}: ${issues.join('; ')}`);
        stillFailing.push(original);
        continue;
      }

      await db.insert(cards).values({
        userId: user.id,
        domain: original.domain,
        topic: original.topic,
        type: 'multiple_choice',
        content: contentFromCard(card),
        status: 'active',
        sourceType: 'regenerated',
        sourceRef: original.id,
        authoredDifficulty: card.authoredDifficulty,
        objective: original.objective,
      });
      await db.update(cards).set({ status: 'archived' }).where(eq(cards.id, original.id));
      console.log(`  Approved replacement for [${original.domain} / ${original.topic}], original archived.`);
      lastCard.delete(original.id);
    }

    currentCards = stillFailing;
  }

  if (currentCards.length > 0) {
    console.log(`\n${currentCards.length} card(s) still failing after ${MAX_ATTEMPTS} attempts — left untouched, original still active:`);
    for (const c of currentCards) console.log(`  - [${c.domain} / ${c.topic}] (${c.id})`);
  } else {
    console.log('\nDone. All broken cards replaced.');
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
