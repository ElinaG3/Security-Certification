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

export async function scheduleReview({
  db,
  cardRow,
  userId,
  questionType,
  correct,
  responseMs,
  now = new Date(),
}: {
  db: ReturnType<typeof getDb>;
  cardRow: CardRow;
  userId: string;
  questionType: QuestionType;
  correct: boolean;
  responseMs: number;
  now?: Date;
}) {
  const medianMs = await getRollingMedianMs(db, userId, questionType);
  const rating = deriveRating(correct, responseMs, medianMs);

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

  const logInsert = reviewLogRowFromLog(log, { cardId: cardRow.id, userId, responseMs });

  return { rating, cardUpdate, logInsert };
}

function reviewLogRowFromLog(
  log: ReviewLog,
  extra: { cardId: string; userId: string; responseMs: number }
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
  };
}

export { Rating };
