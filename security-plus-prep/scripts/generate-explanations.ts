import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { eq, and, inArray, notInArray } from 'drizzle-orm';
import { getDb } from '../src/db';
import { cards, explanationSuggestions } from '../src/db/schema';
import { getCurrentUser } from '../src/lib/auth';
import type { MultipleChoiceContent } from '../src/db/question-types';

const MODEL = 'claude-sonnet-5';
const BATCH_SIZE = 15;

const client = new Anthropic();

const BatchResultSchema = z.object({
  explanations: z.array(
    z.object({
      cardId: z.string(),
      distractorExplanations: z.array(z.string()),
    })
  ),
});

const submitExplanationsTool: Anthropic.Tool = {
  name: 'submit_explanations',
  description: 'Submit per-distractor explanations for a batch of multiple-choice questions.',
  input_schema: {
    type: 'object',
    properties: {
      explanations: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            cardId: { type: 'string', description: 'The id of the card this entry answers' },
            distractorExplanations: {
              type: 'array',
              description:
                'One entry per option, same order as the question options. For the correct option, use an empty string. For each wrong option, one concise sentence explaining why it is wrong in the context of the CompTIA Security+ (SY0-701) exam.',
              items: { type: 'string' },
            },
          },
          required: ['cardId', 'distractorExplanations'],
        },
      },
    },
    required: ['explanations'],
  },
};

type Batchable = {
  id: string;
  domain: string;
  topic: string;
  content: MultipleChoiceContent;
};

function buildPrompt(batch: Batchable[]): string {
  const questions = batch
    .map((card, i) => {
      const { question, options, correct, explanation } = card.content;
      const optionsList = options.map((opt, idx) => `  ${idx}: ${opt}`).join('\n');
      return `Question ${i + 1} (cardId: ${card.id})
Domain: ${card.domain} — ${card.topic}
Q: ${question}
Options:
${optionsList}
Correct index: ${correct}
Existing explanation for the correct answer: ${explanation}`;
    })
    .join('\n\n');

  return `For each of the following CompTIA Security+ (SY0-701) multiple-choice questions, write a one-sentence explanation for why each WRONG option is incorrect. Use the empty string for the correct option's entry. Keep each explanation concise (one sentence) and specific to the option, not a restatement of the correct answer.

${questions}

Call submit_explanations with one entry per question above, in the same order, using the exact cardId given.`;
}

async function generateBatch(batch: Batchable[]) {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    tools: [submitExplanationsTool],
    tool_choice: { type: 'tool', name: 'submit_explanations' },
    messages: [{ role: 'user', content: buildPrompt(batch) }],
  });

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
  );
  if (!toolUse) throw new Error('No tool_use block in response');

  return BatchResultSchema.parse(toolUse.input).explanations;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function main() {
  const sampleArg = process.argv.find((a) => a.startsWith('--sample='));
  const sampleSize = sampleArg ? Number(sampleArg.split('=')[1]) : null;

  const db = getDb();
  const user = await getCurrentUser();

  const alreadyStaged = await db
    .select({ cardId: explanationSuggestions.cardId })
    .from(explanationSuggestions)
    .where(inArray(explanationSuggestions.status, ['pending', 'approved']));
  const stagedIds = alreadyStaged.map((r) => r.cardId);

  const candidates = await db
    .select()
    .from(cards)
    .where(
      and(
        eq(cards.userId, user.id),
        eq(cards.type, 'multiple_choice'),
        eq(cards.status, 'active'),
        stagedIds.length > 0 ? notInArray(cards.id, stagedIds) : undefined
      )
    );

  const targets = (
    sampleSize ? candidates.slice(0, sampleSize) : candidates
  ) as Batchable[];

  if (targets.length === 0) {
    console.log('No cards need explanations.');
    return;
  }

  console.log(`Generating explanations for ${targets.length} card(s)...`);

  const batches = chunk(targets, BATCH_SIZE);
  let total = 0;

  for (const [i, batch] of batches.entries()) {
    console.log(`Batch ${i + 1}/${batches.length} (${batch.length} questions)...`);
    const results = await generateBatch(batch);

    for (const result of results) {
      const card = batch.find((c) => c.id === result.cardId);
      if (!card) {
        console.warn(`  Model returned unknown cardId ${result.cardId}, skipping.`);
        continue;
      }

      if (sampleSize) {
        console.log(`\n--- ${card.content.question}`);
        card.content.options.forEach((opt, idx) => {
          const marker = idx === card.content.correct ? '(correct)' : '(wrong)';
          console.log(`  ${idx} ${marker}: ${opt}`);
          if (idx !== card.content.correct) {
            console.log(`     -> ${result.distractorExplanations[idx] ?? '(missing)'}`);
          }
        });
      } else {
        await db.insert(explanationSuggestions).values({
          cardId: card.id,
          distractorExplanations: result.distractorExplanations,
          status: 'pending',
        });
        total++;
      }
    }
  }

  if (sampleSize) {
    console.log(`\nSample complete — nothing written to the database.`);
  } else {
    console.log(`\nStaged ${total} pending suggestion(s). Run scripts/review-explanations.ts to approve.`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
