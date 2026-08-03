'use server';

import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { cards, reviewLog } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth';
import { scheduleReview } from '@/lib/fsrs';
import type { MultipleChoiceContent, MultipleSelectContent } from '@/db/question-types';

export interface SubmitAnswerResult {
  correct: boolean;
  correctAnswer: number | number[];
  explanation: string;
  distractorExplanations?: string[];
}

function isCorrect(
  type: 'multiple_choice' | 'multiple_select',
  content: MultipleChoiceContent | MultipleSelectContent,
  selected: number[]
): boolean {
  if (type === 'multiple_choice') {
    const c = content as MultipleChoiceContent;
    return selected.length === 1 && selected[0] === c.correct;
  }
  const c = content as MultipleSelectContent;
  const correctSet = new Set(c.correct);
  const selectedSet = new Set(selected);
  return (
    correctSet.size === selectedSet.size && [...correctSet].every((i) => selectedSet.has(i))
  );
}

// The only place in the app where a card's correct answer or explanation is
// computed and transmitted — this runs exclusively on the server, and only
// after the client has already submitted an answer. The initial page load
// (app/study/page.tsx) never sends these fields to the browser.
export async function submitAnswer({
  cardId,
  selected,
  responseMs,
}: {
  cardId: string;
  selected: number[];
  responseMs: number;
}): Promise<SubmitAnswerResult> {
  const user = await getCurrentUser();
  const db = getDb();

  const [cardRow] = await db
    .select()
    .from(cards)
    .where(eq(cards.id, cardId));

  if (!cardRow || cardRow.userId !== user.id) {
    throw new Error('Card not found');
  }
  if (cardRow.type !== 'multiple_choice' && cardRow.type !== 'multiple_select') {
    throw new Error(`Unsupported question type for review: ${cardRow.type}`);
  }

  const content = cardRow.content as MultipleChoiceContent | MultipleSelectContent;
  const correct = isCorrect(cardRow.type, content, selected);

  const { cardUpdate, logInsert } = await scheduleReview({
    db,
    cardRow,
    userId: user.id,
    questionType: cardRow.type,
    correct,
    responseMs,
  });

  await db.update(cards).set(cardUpdate).where(eq(cards.id, cardId));
  await db.insert(reviewLog).values(logInsert);

  return {
    correct,
    correctAnswer: cardRow.type === 'multiple_choice'
      ? (content as MultipleChoiceContent).correct
      : (content as MultipleSelectContent).correct,
    explanation: content.explanation,
    distractorExplanations: content.distractorExplanations,
  };
}
