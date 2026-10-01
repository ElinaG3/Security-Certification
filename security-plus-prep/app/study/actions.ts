'use server';

import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { cards, reviewLog, gradingOverrides } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth';
import {
  scheduleReview,
  schedulePbqReview,
  logUnscheduledReview,
  computeRatingForChoice,
  computeRatingForPbq,
  Rating,
} from '@/lib/fsrs';
import { gradeSubQuestion, gradeRemediationSelect, type OptionGrade } from '@/lib/pbq-grading';
import { invertOrder, isValidOrder } from '@/lib/option-order';
import { gradeFillIn } from '@/lib/fill-in-grading';
import { gradeFillInExplanation, type ExplanationVerdict } from '@/lib/fill-in-explanation-grading';
import type {
  MultipleChoiceContent,
  MultipleSelectContent,
  ArtifactPbqContent,
  RemediationSelectContent,
  FillInContent,
} from '@/db/question-types';

// FSRS-relevant fields only — the subset a review actually changes, and
// the subset needed to re-run scheduling "as if" a different rating had
// been applied. Captured from a card row BEFORE scheduling and stashed on
// the reviewLog row so a later grading override (see overrideFillInAnswer)
// can redo scheduling from the true prior state, not an already-downgraded
// one. reps/lapses matter here and are exactly what ts-fsrs's own
// ReviewLog shape (mirrored by reviewLog's other columns) omits.
type PreReviewSnapshot = Pick<
  typeof cards.$inferSelect,
  'state' | 'due' | 'stability' | 'difficulty' | 'elapsedDays' | 'scheduledDays' | 'learningSteps' | 'reps' | 'lapses' | 'lastReview'
>;

function snapshotCardRow(cardRow: typeof cards.$inferSelect): PreReviewSnapshot {
  return {
    state: cardRow.state,
    due: cardRow.due,
    stability: cardRow.stability,
    difficulty: cardRow.difficulty,
    elapsedDays: cardRow.elapsedDays,
    scheduledDays: cardRow.scheduledDays,
    learningSteps: cardRow.learningSteps,
    reps: cardRow.reps,
    lapses: cardRow.lapses,
    lastReview: cardRow.lastReview,
  };
}

// One-click "pull this out of rotation" while studying — the main defense
// against a weak card, since cards are seen one at a time in real use.
// Independent of status/FSRS state: getDueQueue/getPbqWarmupQueue exclude
// flagged cards, nothing else about the card changes, and it can be
// unflagged from /review at any time.
export async function flagCard({ cardId, note }: { cardId: string; note?: string }): Promise<void> {
  const user = await getCurrentUser();
  const db = getDb();
  const [cardRow] = await db.select().from(cards).where(eq(cards.id, cardId));
  if (!cardRow || cardRow.userId !== user.id) throw new Error('Card not found');
  await db.update(cards).set({ flagged: true, flagNote: note ?? null }).where(eq(cards.id, cardId));
}

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
    }
  | {
      kind: 'fill_in';
      score: number;
      correct: boolean;
      correctAnswer?: string; // first accepted answer — display purposes only ('exact' mode only)
      explanation: string;
      gradingMode: 'exact' | 'ai';
      matchedVia?: 'string' | 'ai'; // 'exact' mode only
      verdict?: ExplanationVerdict; // 'ai' mode only
      reason?: string; // 'ai' mode only — one-line grading rationale
      // Lets the client request the "I was right" override for this
      // specific rep — see overrideFillInAnswer. Only meaningful when
      // score === 0 (genuinely wrong, not partial).
      reviewLogId: string;
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
): Promise<string> {
  if (result.cardUpdate) {
    await db.update(cards).set(result.cardUpdate).where(eq(cards.id, cardId));
  }
  const [inserted] = await db.insert(reviewLog).values(result.logInsert).returning({ id: reviewLog.id });
  return inserted.id;
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
  selected: number[] | number[][] | string;
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

  if (cardRow.type === 'fill_in') {
    const content = cardRow.content as FillInContent;
    const sel = (typeof selected === 'string' ? selected : '').trim();
    const preReviewSnapshot = snapshotCardRow(cardRow);

    if (content.gradingMode === 'ai') {
      const { verdict, reason } = await gradeFillInExplanation(sel, content);
      const score = verdict === 'correct' ? 1 : verdict === 'partial' ? 0.5 : 0;
      const subResults = { verdict, reason };

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
      result.logInsert.preReviewSnapshot = preReviewSnapshot;

      const reviewLogId = await persistReview(db, cardId, result);

      return {
        kind: 'fill_in',
        score,
        correct: verdict === 'correct',
        explanation: content.explanation,
        gradingMode: 'ai',
        verdict,
        reason,
        reviewLogId,
      };
    }

    const { correct, matchedVia } = await gradeFillIn(sel, content.acceptedAnswers);

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
    result.logInsert.preReviewSnapshot = preReviewSnapshot;

    const reviewLogId = await persistReview(db, cardId, result);

    return {
      kind: 'fill_in',
      score: correct ? 1 : 0,
      correct,
      correctAnswer: content.acceptedAnswers[0],
      explanation: content.explanation,
      gradingMode: 'exact',
      matchedVia,
      reviewLogId,
    };
  }

  throw new Error(`Unsupported question type for review: ${cardRow.type}`);
}

export type OverrideFillInResult = { ok: true; rescheduled: boolean } | { ok: false; issue: string };

// "I was right" override for typed-answer (fill_in) grading: the user's
// answer was marked wrong but was actually correct. Re-runs FSRS
// scheduling from the review's OWN pre-review snapshot — so the result is
// exactly as if this rep had been graded correct from the start, not a
// patch layered on top of the wrong grading — and, for 'exact' mode cards
// (where acceptedAnswers are literal correct strings), adds the submitted
// answer to the card's acceptedAnswers so the same phrasing auto-passes
// next time. 'ai' mode cards aren't touched here: their acceptedAnswers
// are key POINTS, not literal strings, so appending a full free-text
// answer there would corrupt that list's meaning.
//
// The original wrong-graded reviewLog row is never mutated (reviewLog is
// append-only) — the correction is a new row, and both are linked from a
// gradingOverrides row for audit.
export async function overrideFillInAnswer({
  reviewLogId,
  userAnswer,
}: {
  reviewLogId: string;
  userAnswer: string;
}): Promise<OverrideFillInResult> {
  const user = await getCurrentUser();
  const db = getDb();

  const [log] = await db.select().from(reviewLog).where(eq(reviewLog.id, reviewLogId));
  if (!log || log.userId !== user.id) return { ok: false, issue: 'Review not found.' };
  if (log.rating !== Rating.Again) return { ok: false, issue: 'Only a review marked wrong can be overridden.' };
  if (!log.preReviewSnapshot) return { ok: false, issue: 'This review predates override support.' };

  const [alreadyOverridden] = await db.select().from(gradingOverrides).where(eq(gradingOverrides.reviewLogId, reviewLogId));
  if (alreadyOverridden) return { ok: false, issue: 'This review was already overridden.' };

  const [cardRow] = await db.select().from(cards).where(eq(cards.id, log.cardId));
  if (!cardRow || cardRow.userId !== user.id || cardRow.type !== 'fill_in') {
    return { ok: false, issue: 'Card not found.' };
  }

  // Overlay the pre-review FSRS fields onto the current row — everything
  // else (content, domain, flags, ...) stays as-is; only scheduling state
  // reverts to what it was right before the wrong grading was applied.
  const preReviewCardRow = { ...cardRow, ...(log.preReviewSnapshot as PreReviewSnapshot) };

  // A not-due (warm-up) rep never called scheduler.next() in the first
  // place (logUnscheduledReview), so there's nothing to reschedule —
  // `scheduled` on the original log row says which case this was.
  let correctionLogId: string | null = null;
  if (log.scheduled) {
    const result = await scheduleReview({
      db,
      cardRow: preReviewCardRow,
      userId: user.id,
      questionType: 'fill_in',
      correct: true,
      responseMs: log.responseMs,
      elaborationSkipped: log.elaborationSkipped,
      now: log.review, // same moment as the original rep, so elapsed-days math matches what actually happened
    });
    correctionLogId = await persistReview(db, cardRow.id, result);
  }

  const content = cardRow.content as FillInContent;
  if (content.gradingMode === 'exact') {
    const trimmed = userAnswer.trim();
    const alreadyListed = content.acceptedAnswers.some((a) => a.trim().toLowerCase() === trimmed.toLowerCase());
    if (trimmed !== '' && !alreadyListed) {
      await db
        .update(cards)
        .set({ content: { ...content, acceptedAnswers: [...content.acceptedAnswers, trimmed] } })
        .where(eq(cards.id, cardRow.id));
    }
  }

  await db.insert(gradingOverrides).values({
    reviewLogId,
    correctionLogId,
    cardId: cardRow.id,
    userId: user.id,
    submittedAnswer: userAnswer,
  });

  return { ok: true, rescheduled: log.scheduled };
}
