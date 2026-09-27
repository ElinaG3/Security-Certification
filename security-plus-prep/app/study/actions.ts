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
import { invertOrder, isValidOrder } from '@/lib/option-order';
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
  optionOrder,
}: {
  cardId: string;
  selected: number[] | number[][];
  responseMs: number;
  elaborationSkipped: boolean;
  // Required for multiple_choice/multiple_select: the display permutation
  // the client was rendered with (see toPublicContent in question-public.ts
  // and the PublicMultipleChoiceContent/PublicMultipleSelectContent doc
  // comment). `selected` arrives in DISPLAY order; this is how it's
  // translated back to STORAGE order for grading below.
  optionOrder?: number[];
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
    // `content` is the server's own copy of the card, fetched fresh from the
    // DB above — `content.correct` never comes from the client, and nothing
    // the client sends can change what `content.correct` is. `optionOrder`
    // only tells us how to translate the client's DISPLAY-order selection
    // back to the STORAGE-order indices `content.correct` is expressed in;
    // it is not itself a source of truth for correctness. Since the render
    // path (toPublicContent) never sends `correct` or explanations to the
    // browser before this point, nothing the client holds is correlated
    // with which index is actually correct — a client can't pick values for
    // `selected`/`optionOrder` that reliably turn a wrong pick into a
    // correct grade without already knowing the answer by other means.
    const content = cardRow.content as MultipleChoiceContent | MultipleSelectContent;
    if (!isValidOrder(optionOrder, content.options.length)) {
      throw new Error('Missing or invalid optionOrder for a multiple_choice/multiple_select card');
    }
    const displayedSel = selected as number[];
    const sel = displayedSel.map((displayIndex) => optionOrder[displayIndex]); // -> storage order
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

    // Translate the response back to DISPLAY order (inverse of the
    // translation above) so it lines up with the `options` array the
    // client already has — result.correctAnswer / .distractorExplanations
    // must index into the same shuffled order the client rendered, not the
    // card's storage order.
    const displayIndexOf = invertOrder(optionOrder);
    const storedCorrect =
      cardRow.type === 'multiple_choice'
        ? (content as MultipleChoiceContent).correct
        : (content as MultipleSelectContent).correct;

    return {
      kind: 'choice',
      score: correct ? 1 : 0,
      correct,
      correctAnswer: Array.isArray(storedCorrect)
        ? storedCorrect.map((i) => displayIndexOf[i])
        : displayIndexOf[storedCorrect],
      explanation: content.explanation,
      distractorExplanations: content.distractorExplanations
        ? optionOrder.map((storedIndex) => content.distractorExplanations![storedIndex])
        : undefined,
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
