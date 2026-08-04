// Repairs cards that check-card-consistency.ts auto-rejected — fixes only
// the broken field(s), keeps question/options/correct/explanation intact.
// Two repair types:
//   1. Missing "(Choose N.)" phrasing on multiple_select — deterministic
//      text fix, no AI call.
//   2. Broken distractorExplanations array (wrong length / misaligned) —
//      AI regenerates only that field, given the existing question+options
//      as fixed context.
// Re-checks each repaired card; sets status back to 'pending' only if it
// now passes. Cards that still fail after repair stay 'rejected' and are
// reported.
//
// Usage: npx dotenv-cli -e .env.local -e .env -- tsx scripts/repair-rejected-cards.ts

import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { getDb } from '../src/db';
import { cards } from '../src/db/schema';
import type { MultipleChoiceContent, MultipleSelectContent } from '../src/db/question-types';
import { checkCardConsistency } from './check-card-consistency';

const MODEL = 'claude-sonnet-5';
const BATCH_SIZE = 6;
const client = new Anthropic();

type Content = MultipleChoiceContent | MultipleSelectContent;

const NUMBER_TO_WORD: Record<number, string> = { 2: 'two', 3: 'three', 4: 'four', 5: 'five' };

function fixChooseNPhrasing(content: MultipleSelectContent): MultipleSelectContent {
  if (/\(Choose \w+\.?\)/i.test(content.question)) return content; // already present
  const word = NUMBER_TO_WORD[content.requiredCount] ?? String(content.requiredCount);
  return { ...content, question: `${content.question.trim()} (Choose ${word}.)` };
}

const FixResultSchema = z.object({
  fixes: z.array(z.object({ id: z.string(), distractorExplanations: z.array(z.string()) })),
});

const submitFixesTool: Anthropic.Tool = {
  name: 'submit_fixes',
  description: 'Submit corrected distractorExplanations arrays for a batch of questions.',
  input_schema: {
    type: 'object',
    properties: {
      fixes: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'The id given for this question' },
            distractorExplanations: {
              type: 'array',
              items: { type: 'string' },
              description:
                'MUST have exactly one entry per option, same order as options. Empty string "" at every correct index. Non-empty, option-specific text at every other index.',
            },
          },
          required: ['id', 'distractorExplanations'],
        },
      },
    },
    required: ['fixes'],
  },
};

function buildFixPrompt(batch: { id: string; content: Content }[]): string {
  const items = batch
    .map(({ id, content }) => {
      const correctIndices = Array.isArray(content.correct) ? content.correct : [content.correct];
      const optionsList = content.options
        .map((opt, idx) => `  ${idx}${correctIndices.includes(idx) ? ' [CORRECT]' : ''}: ${opt}`)
        .join('\n');
      return `id: ${id}\nQ: ${content.question}\nOptions:\n${optionsList}`;
    })
    .join('\n\n');

  return `For each question below, write a fresh distractorExplanations array. Rules:
- Exactly one entry per option, in the same order as the options listed.
- Empty string "" at every [CORRECT] index.
- At every other index, a concise, option-specific sentence explaining why that specific option is wrong for this question — not a generic restatement of the correct answer.
- Do not skip or renumber indices — the array's length must equal the number of options shown, including the correct one(s).

${items}

Call submit_fixes with one entry per question above, using the exact id given.`;
}

async function fixBatch(batch: { id: string; content: Content }[]) {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    tools: [submitFixesTool],
    tool_choice: { type: 'tool', name: 'submit_fixes' },
    messages: [{ role: 'user', content: buildFixPrompt(batch) }],
  });
  const toolUse = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
  );
  if (!toolUse) throw new Error('No tool_use block in response');
  return FixResultSchema.parse(toolUse.input).fixes;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function main() {
  const db = getDb();
  const rejected = await db.select().from(cards).where(eq(cards.status, 'rejected'));
  console.log(`Found ${rejected.length} rejected card(s).\n`);

  // Step 1: deterministic "(Choose N.)" fix where that's the only issue class present.
  const stillNeedsDeExplanations: { id: string; content: Content }[] = [];
  let choosePhraseFixed = 0;

  for (const card of rejected) {
    let content = card.content as Content;

    if (card.type === 'multiple_select') {
      const before = content as MultipleSelectContent;
      const after = fixChooseNPhrasing(before);
      if (after.question !== before.question) {
        content = after;
        choosePhraseFixed++;
      }
    }

    const issues = checkCardConsistency(content, card.type);
    const hasDeIssue = issues.some((i) => i.includes('distractorExplanation') || i.includes('missing distractorExplanations'));

    if (hasDeIssue) {
      stillNeedsDeExplanations.push({ id: card.id, content });
    } else {
      // Fully fixed by the phrasing change alone (or was already fine) — persist + reinstate.
      await db.update(cards).set({ content, status: 'pending' }).where(eq(cards.id, card.id));
    }
  }

  console.log(`"(Choose N.)" phrasing fixed on ${choosePhraseFixed} card(s).`);
  console.log(`${stillNeedsDeExplanations.length} card(s) need distractorExplanations regenerated via AI.\n`);

  // Step 2: AI-regenerate distractorExplanations for the rest.
  const batches = chunk(stillNeedsDeExplanations, BATCH_SIZE);
  const stillBroken: string[] = [];

  for (const [i, batch] of batches.entries()) {
    console.log(`Batch ${i + 1}/${batches.length} (${batch.length} cards)...`);
    const fixes = await fixBatch(batch);

    for (const { id, content } of batch) {
      const fix = fixes.find((f) => f.id === id);
      if (!fix) {
        console.warn(`  No fix returned for ${id}`);
        stillBroken.push(id);
        continue;
      }
      const newContent = { ...content, distractorExplanations: fix.distractorExplanations };
      const cardRow = rejected.find((c) => c.id === id)!;
      const issues = checkCardConsistency(newContent, cardRow.type);

      if (issues.length === 0) {
        await db.update(cards).set({ content: newContent, status: 'pending' }).where(eq(cards.id, id));
      } else {
        console.warn(`  ${id} still fails after repair: ${issues.join('; ')}`);
        await db.update(cards).set({ content: newContent }).where(eq(cards.id, id)); // save progress, stay rejected
        stillBroken.push(id);
      }
    }
  }

  const totalRepaired = rejected.length - stillBroken.length;
  console.log(`\nRepaired and reinstated to pending: ${totalRepaired} / ${rejected.length}`);
  if (stillBroken.length > 0) {
    console.log(`Still broken, left as 'rejected': ${stillBroken.join(', ')}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
