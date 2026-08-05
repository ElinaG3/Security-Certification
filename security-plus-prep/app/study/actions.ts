'use server';

import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { cards, reviewLog } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth';
import {
  scheduleReview,
  schedulePbqReview,
  logUnscheduledReview,
  computeRatingForChoice,
  computeRatingForPbq,
} from '@/lib/fsrs';
import { gradeSubQuestion, gradeRemediationSelect, type OptionGrade } from '@/lib/pbq-grading';
import type {
  MultipleChoiceContent,
  MultipleSelectContent,
  ArtifactPbqContent,
  RemediationSelectContent,
} from '@/db/question-types';

export type SubmitAnswerResult =
  | {
      kind: 'choice';
      score: number;
      correct: boolean;
      correctAnswer: number | number[];
      explanation: string;
      distractorExplanations?: string[];
      mnemonic?: string;
    }
  | {
      kind: 'artifact_pbq';
      score: number;
      correct: boolean;
      subQuestions: { correct: boolean; correctAnswer: number[]; options: OptionGrade[] }[];
    }
  | {
      kind: 'remediation';
      score: number;
      correct: boolean;
      options: OptionGrade[];
    };

function isChoiceCorrect(
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

type ScheduleResult = {
  cardUpdate: Partial<typeof cards.$inferInsert> | null;
  logInsert: typeof reviewLog.$inferInsert;
};

// Shared by every branch below: if the card is actually due, run the real
// scheduler; if not (a warm-up practice rep on a not-yet-due card, or any
// future non-due-serving path), skip scheduling entirely and just log the
// rep with `scheduled: false`. `due` is decided once in submitAnswer from
// the card's own row — never from a client-supplied flag — so this can't
// be spoofed into corrupting FSRS state.
async function persistReview(
  db: ReturnType<typeof getDb>,
  cardId: string,
  result: ScheduleResult
): Promise<void> {
  if (result.cardUpdate) {
    await db.update(cards).set(result.cardUpdate).where(eq(cards.id, cardId));
  }
  await db.insert(reviewLog).values(result.logInsert);
}

// The only place in the app where a card's correct answer or explanation is
// computed and transmitted — this runs exclusively on the server, and only
// after the client has already submitted an answer. The initial page load
// (app/study/page.tsx) never sends these fields to the browser.
export async function submitAnswer({
  cardId,
  selected,
  responseMs,
  elaborationSkipped,
}: {
  cardId: string;
  selected: number[] | number[][];
  responseMs: number;
  elaborationSkipped: boolean;
}): Promise<SubmitAnswerResult> {
  const user = await getCurrentUser();
  const db = getDb();
  const now = new Date();

  const [cardRow] = await db.select().from(cards).where(eq(cards.id, cardId));
  if (!cardRow || cardRow.userId !== user.id) {
    throw new Error('Card not found');
  }

  const due = cardRow.due <= now;

  if (cardRow.type === 'multiple_choice' || cardRow.type === 'multiple_select') {
    const content = cardRow.content as MultipleChoiceContent | MultipleSelectContent;
    const sel = selected as number[];
    const correct = isChoiceCorrect(cardRow.type, content, sel);

    const result: ScheduleResult = due
      ? await scheduleReview({
          db,
          cardRow,
          userId: user.id,
          questionType: cardRow.type,
          correct,
          responseMs,
          elaborationSkipped,
        })
      : {
          cardUpdate: null,
          logInsert: logUnscheduledReview({
            cardRow,
            userId: user.id,
            rating: await computeRatingForChoice(db, user.id, cardRow.type, correct, responseMs),
            responseMs,
            elaborationSkipped,
            subResults: null,
            now,
          }).logInsert,
        };

    await persistReview(db, cardId, result);

    return {
      kind: 'choice',
      score: correct ? 1 : 0,
      correct,
      correctAnswer:
        cardRow.type === 'multiple_choice'
          ? (content as MultipleChoiceContent).correct
          : (content as MultipleSelectContent).correct,
      explanation: content.explanation,
      distractorExplanations: content.distractorExplanations,
      mnemonic: cardRow.mnemonic ?? undefined,
    };
  }

  if (cardRow.type === 'log_analysis' || cardRow.type === 'config_table') {
    const content = cardRow.content as ArtifactPbqContent;
    const selections = selected as number[][];
    if (selections.length !== content.subQuestions.length) {
      throw new Error('Selection count does not match sub-question count');
    }

    const subQuestionGrades = content.subQuestions.map((sq, i) =>
      gradeSubQuestion(sq, content.artifact, selections[i] ?? [])
    );
    const score = subQuestionGrades.filter((g) => g.correct).length / subQuestionGrades.length;
    const correct = score >= 1;
    const subResults = { score, subQuestions: subQuestionGrades };

    const result: ScheduleResult = due
      ? await schedulePbqReview({
          db,
          cardRow,
          userId: user.id,
          questionType: cardRow.type,
          score,
          responseMs,
          elaborationSkipped,
          subResults,
        })
      : {
          cardUpdate: null,
          logInsert: logUnscheduledReview({
            cardRow,
            userId: user.id,
            rating: await computeRatingForPbq(db, user.id, cardRow.type, score, responseMs),
            responseMs,
            elaborationSkipped,
            subResults,
            now,
          }).logInsert,
        };

    await persistReview(db, cardId, result);

    return { kind: 'artifact_pbq', score, correct, subQuestions: subQuestionGrades };
  }

  if (cardRow.type === 'remediation_select') {
    const content = cardRow.content as RemediationSelectContent;
    const sel = selected as number[];
    const { score, options } = gradeRemediationSelect(sel, content.correctActions, content.explanationByOption);
    const correct = score >= 1;
    const subResults = { score, options };

    const result: ScheduleResult = due
      ? await schedulePbqReview({
          db,
          cardRow,
          userId: user.id,
          questionType: cardRow.type,
          score,
          responseMs,
          elaborationSkipped,
          subResults,
        })
      : {
          cardUpdate: null,
          logInsert: logUnscheduledReview({
            cardRow,
            userId: user.id,
            rating: await computeRatingForPbq(db, user.id, cardRow.type, score, responseMs),
            responseMs,
            elaborationSkipped,
            subResults,
            now,
          }).logInsert,
        };

    await persistReview(db, cardId, result);

    return { kind: 'remediation', score, correct, options };
  }

  throw new Error(`Unsupported question type for review: ${cardRow.type}`);
}
