import { createInterface } from 'node:readline/promises';
import { eq } from 'drizzle-orm';
import { getDb } from '../src/db';
import { cards } from '../src/db/schema';
import type { MultipleChoiceContent, MultipleSelectContent } from '../src/db/question-types';

async function main() {
  const db = getDb();

  const pending = await db.select().from(cards).where(eq(cards.status, 'pending'));

  if (pending.length === 0) {
    console.log('No pending cards.');
    return;
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  let approved = 0;
  let rejected = 0;

  for (const [i, card] of pending.entries()) {
    const content = card.content as MultipleChoiceContent | MultipleSelectContent;
    const correctIndices = Array.isArray(content.correct) ? content.correct : [content.correct];

    console.log(
      `\n[${i + 1}/${pending.length}] ${card.domain} — ${card.topic} (obj ${card.objective}, ${card.authoredDifficulty}, ${card.type})`
    );
    console.log(`Q: ${content.question}`);
    content.options.forEach((opt, idx) => {
      const marker = correctIndices.includes(idx) ? '(correct)' : '(wrong)';
      console.log(`  ${idx} ${marker}: ${opt}`);
      if (!correctIndices.includes(idx) && content.distractorExplanations?.[idx]) {
        console.log(`     -> ${content.distractorExplanations[idx]}`);
      }
    });
    console.log(`Explanation: ${content.explanation}`);

    const answer = (await rl.question('Approve? [y/n/q to quit] ')).trim().toLowerCase();

    if (answer === 'q') break;

    if (answer === 'y') {
      await db.update(cards).set({ status: 'active' }).where(eq(cards.id, card.id));
      approved++;
    } else {
      await db.update(cards).set({ status: 'rejected' }).where(eq(cards.id, card.id));
      rejected++;
    }
  }

  rl.close();
  console.log(`\nApproved ${approved}, rejected ${rejected}.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
