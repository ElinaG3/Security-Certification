import { fsrs, Rating, State, type Card, type Grade, type ReviewLog } from 'ts-fsrs';
import { and, desc, eq, ne } from 'drizzle-orm';
import type { getDb } from '@/db';
import { cards, reviewLog } from '@/db/schema';
import type { QuestionType } from '@/db/question-types';

const scheduler = fsrs();

const STATE_TO_DB = {
  [State.New]: 'new',
  [State.Learning]: 'learning',
  [State.Review]: 'review',
  [State.Relearning]: 'relearning',
} as const;

const DB_TO_STATE: Record<string, State> = {
  new: State.New,
  learning: State.Learning,
  review: State.Review,
  relearning: State.Relearning,
};

type CardRow = typeof cards.$inferSelect;

function rowToCard(row: CardRow): Card {
  return {
    due: row.due,
    stability: row.stability,
    difficulty: row.difficulty,
    elapsed_days: row.elapsedDays,
    scheduled_days: row.scheduledDays,
    learning_steps: row.learningSteps,
    reps: row.reps,
    lapses: row.lapses,
    state: DB_TO_STATE[row.state] ?? State.New,
    last_review: row.lastReview ?? undefined,
  };
}

// Minimum number of prior correct reviews of a question type before the
// response-time signal is trusted. Below this, every correct answer maps
// to Rating.Good regardless of speed.
const MIN_SAMPLES_FOR_SPEED_RATING = 5;
const ROLLING_WINDOW = 20;
const HARD_THRESHOLD = 2.5; // response time > this * median -> Hard
const EASY_THRESHOLD = 0.4; // response time < this * median -> Easy

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

async function getRollingMedianMs(
  db: ReturnType<typeof getDb>,
  userId: string,
  questionType: QuestionType
): Promise<number | null> {
  const rows = await db
    .select({ responseMs: reviewLog.responseMs })
    .from(reviewLog)
    .innerJoin(cards, eq(reviewLog.cardId, cards.id))
    .where(and(eq(reviewLog.userId, userId), eq(cards.type, questionType), ne(reviewLog.rating, Rating.Again)))
    .orderBy(desc(reviewLog.review))
    .limit(ROLLING_WINDOW);

  if (rows.length < MIN_SAMPLES_FOR_SPEED_RATING) return null;
  return median(rows.map((r) => r.responseMs));
}

function deriveRating(correct: boolean, responseMs: number, medianMs: number | null): Grade {
  if (!correct) return Rating.Again;
  if (medianMs === null) return Rating.Good;
  if (responseMs > medianMs * HARD_THRESHOLD) return Rating.Hard;
  if (responseMs < medianMs * EASY_THRESHOLD) return Rating.Easy;
  return Rating.Good;
}

// PBQ rating is score-based rather than boolean-correct: partial credit
// (remediation_select's continuous score, or an artifact PBQ's fraction of
// correct sub-questions) maps to Hard rather than collapsing to Again or
// Good. No slow-response Hard case here (unlike deriveRating) — only a
// fast-response Easy bonus, same threshold.
function derivePbqRating(score: number, responseMs: number, medianMs: number | null): Grade {
  if (score < 0.5) return Rating.Again;
  if (score < 1.0) return Rating.Hard;
  if (medianMs !== null && responseMs < medianMs * EASY_THRESHOLD) return Rating.Easy;
  return Rating.Good;
}

async function computeRatingForChoice(
  db: ReturnType<typeof getDb>,
  userId: string,
  questionType: QuestionType,
  correct: boolean,
  responseMs: number
): Promise<Grade> {
  const medianMs = await getRollingMedianMs(db, userId, questionType);
  return deriveRating(correct, responseMs, medianMs);
}

// medianMs is looked up per questionType (never pooled across PBQ types,
// or with multiple_choice/multiple_select) via the existing
// getRollingMedianMs, which already filters by cards.type.
async function computeRatingForPbq(
  db: ReturnType<typeof getDb>,
  userId: string,
  questionType: QuestionType,
  score: number,
  responseMs: number
): Promise<Grade> {
  const medianMs = await getRollingMedianMs(db, userId, questionType);
  return derivePbqRating(score, responseMs, medianMs);
}

function applySchedule({
  cardRow,
  userId,
  rating,
  responseMs,
  elaborationSkipped,
  subResults,
  now,
}: {
  cardRow: CardRow;
  userId: string;
  rating: Grade;
  responseMs: number;
  elaborationSkipped: boolean;
  subResults: unknown;
  now: Date;
}) {
  const card = rowToCard(cardRow);
  const { card: nextCard, log } = scheduler.next(card, now, rating);

  const cardUpdate = {
    due: nextCard.due,
    stability: nextCard.stability,
    difficulty: nextCard.difficulty,
    elapsedDays: nextCard.elapsed_days,
    scheduledDays: nextCard.scheduled_days,
    learningSteps: nextCard.learning_steps,
    reps: nextCard.reps,
    lapses: nextCard.lapses,
    state: STATE_TO_DB[nextCard.state],
    lastReview: nextCard.last_review ?? null,
    updatedAt: now,
  };

  const logInsert = reviewLogRowFromLog(log, {
    cardId: cardRow.id,
    userId,
    responseMs,
    elaborationSkipped,
    subResults,
  });

  return { rating, cardUpdate, logInsert };
}

export async function scheduleReview({
  db,
  cardRow,
  userId,
  questionType,
  correct,
  responseMs,
  elaborationSkipped,
  now = new Date(),
}: {
  db: ReturnType<typeof getDb>;
  cardRow: CardRow;
  userId: string;
  questionType: QuestionType;
  correct: boolean;
  responseMs: number;
  elaborationSkipped: boolean;
  now?: Date;
}) {
  const rating = await computeRatingForChoice(db, userId, questionType, correct, responseMs);
  return applySchedule({ cardRow, userId, rating, responseMs, elaborationSkipped, subResults: null, now });
}

export async function schedulePbqReview({
  db,
  cardRow,
  userId,
  questionType,
  score,
  responseMs,
  elaborationSkipped,
  subResults,
  now = new Date(),
}: {
  db: ReturnType<typeof getDb>;
  cardRow: CardRow;
  userId: string;
  questionType: QuestionType;
  score: number;
  responseMs: number;
  elaborationSkipped: boolean;
  subResults: unknown;
  now?: Date;
}) {
  const rating = await computeRatingForPbq(db, userId, questionType, score, responseMs);
  return applySchedule({ cardRow, userId, rating, responseMs, elaborationSkipped, subResults, now });
}

// The "card isn't actually due" safety net: no scheduler.next() call, no
// `cards` row mutation. Snapshots the card's CURRENT (unchanged) FSRS state
// into the log row rather than an evolved one, since nothing about the
// card's schedule actually changed. `rating` is still computed by the
// caller (via deriveRating/derivePbqRating) purely for the log record —
// it never reaches the scheduler.
export function logUnscheduledReview({
  cardRow,
  userId,
  rating,
  responseMs,
  elaborationSkipped,
  subResults,
  now = new Date(),
}: {
  cardRow: CardRow;
  userId: string;
  rating: Grade;
  responseMs: number;
  elaborationSkipped: boolean;
  subResults: unknown;
  now?: Date;
}) {
  const logInsert = {
    cardId: cardRow.id,
    userId,
    rating,
    state: cardRow.state,
    due: cardRow.due,
    stability: cardRow.stability,
    difficulty: cardRow.difficulty,
    elapsedDays: cardRow.elapsedDays,
    lastElapsedDays: cardRow.elapsedDays,
    scheduledDays: cardRow.scheduledDays,
    learningSteps: cardRow.learningSteps,
    review: now,
    responseMs,
    elaborationSkipped,
    scheduled: false,
    subResults,
  };

  return { logInsert };
}

export { computeRatingForChoice, computeRatingForPbq };

function reviewLogRowFromLog(
  log: ReviewLog,
  extra: {
    cardId: string;
    userId: string;
    responseMs: number;
    elaborationSkipped: boolean;
    subResults: unknown;
  }
) {
  return {
    cardId: extra.cardId,
    userId: extra.userId,
    rating: log.rating,
    state: STATE_TO_DB[log.state],
    due: log.due,
    stability: log.stability,
    difficulty: log.difficulty,
    elapsedDays: log.elapsed_days,
    lastElapsedDays: log.last_elapsed_days,
    scheduledDays: log.scheduled_days,
    learningSteps: log.learning_steps,
    review: log.review,
    responseMs: extra.responseMs,
    elaborationSkipped: extra.elaborationSkipped,
    scheduled: true,
    subResults: extra.subResults,
  };
}

export { Rating };
