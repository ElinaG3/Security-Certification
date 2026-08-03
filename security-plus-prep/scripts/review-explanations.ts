import { createInterface } from 'node:readline/promises';
import { eq } from 'drizzle-orm';
import { getDb } from '../src/db';
import { cards, explanationSuggestions } from '../src/db/schema';
import type { MultipleChoiceContent } from '../src/db/question-types';

async function main() {
  const db = getDb();

  const pending = await db
    .select({
      suggestion: explanationSuggestions,
      card: cards,
    })
    .from(explanationSuggestions)
    .innerJoin(cards, eq(explanationSuggestions.cardId, cards.id))
    .where(eq(explanationSuggestions.status, 'pending'));

  if (pending.length === 0) {
    console.log('No pending suggestions.');
    return;
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  let approved = 0;
  let rejected = 0;

  for (const [i, { suggestion, card }] of pending.entries()) {
    const content = card.content as MultipleChoiceContent;
    const distractorExplanations = suggestion.distractorExplanations as string[];

    console.log(`\n[${i + 1}/${pending.length}] ${card.domain} — ${card.topic}`);
    console.log(`Q: ${content.question}`);
    content.options.forEach((opt, idx) => {
      const marker = idx === content.correct ? '(correct)' : '(wrong)';
      console.log(`  ${idx} ${marker}: ${opt}`);
      if (idx !== content.correct) {
        console.log(`     -> ${distractorExplanations[idx] ?? '(missing)'}`);
      }
    });

    const answer = (await rl.question('Approve? [y/n/q to quit] ')).trim().toLowerCase();

    if (answer === 'q') break;

    if (answer === 'y') {
      await db
        .update(cards)
        .set({ content: { ...content, distractorExplanations } })
        .where(eq(cards.id, card.id));
      await db
        .update(explanationSuggestions)
        .set({ status: 'approved', reviewedAt: new Date() })
        .where(eq(explanationSuggestions.id, suggestion.id));
      approved++;
    } else {
      await db
        .update(explanationSuggestions)
        .set({ status: 'rejected', reviewedAt: new Date() })
        .where(eq(explanationSuggestions.id, suggestion.id));
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
