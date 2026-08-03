import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  real,
  jsonb,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// `type` + `content` form a discriminated union at the application layer
// (see src/db/question-types.ts) so new question types never require a migration.
export const cards = pgTable('cards', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),

  domain: text('domain').notNull(),
  topic: text('topic').notNull(),

  type: text('type').notNull(),
  content: jsonb('content').notNull(),

  // 'active' | 'pending' | 'rejected' — auto-generated cards land as 'pending'
  status: text('status').notNull().default('active'),

  sourceType: text('source_type'), // 'manual' | 'pdf' | 'image' | 'note'
  sourceRef: text('source_ref'), // e.g. file id + page, or note id

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),

  // FSRS scheduling state (mirrors ts-fsrs's Card shape 1:1)
  due: timestamp('due', { withTimezone: true }).notNull().defaultNow(),
  stability: real('stability').notNull().default(0),
  difficulty: real('difficulty').notNull().default(0),
  elapsedDays: integer('elapsed_days').notNull().default(0),
  scheduledDays: integer('scheduled_days').notNull().default(0),
  learningSteps: integer('learning_steps').notNull().default(0),
  reps: integer('reps').notNull().default(0),
  lapses: integer('lapses').notNull().default(0),
  state: text('state').notNull().default('new'), // 'new' | 'learning' | 'review' | 'relearning'
  lastReview: timestamp('last_review', { withTimezone: true }),
});

// Append-only. Never updated or overwritten — one row per review event.
export const reviewLog = pgTable('review_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  cardId: uuid('card_id').notNull().references(() => cards.id),
  userId: uuid('user_id').notNull().references(() => users.id),

  rating: integer('rating').notNull(), // 1=Again 2=Hard 3=Good 4=Easy

  // Snapshot of FSRS state at the moment of this review (mirrors ts-fsrs's ReviewLog shape)
  state: text('state').notNull(),
  due: timestamp('due', { withTimezone: true }).notNull(),
  stability: real('stability').notNull(),
  difficulty: real('difficulty').notNull(),
  elapsedDays: integer('elapsed_days').notNull(),
  lastElapsedDays: integer('last_elapsed_days').notNull(),
  scheduledDays: integer('scheduled_days').notNull(),
  learningSteps: integer('learning_steps').notNull().default(0),
  review: timestamp('review', { withTimezone: true }).notNull(),

  // Wall-clock time the user took to answer, in milliseconds. Always
  // recorded — feeds the response-time-based Hard/Good/Easy rating in
  // src/lib/fsrs.ts, and lets the thresholds be re-tuned later without
  // losing history.
  responseMs: integer('response_ms').notNull(),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Staged output of scripts/generate-explanations.ts. A row here is a
// proposed set of per-distractor explanations for one card, awaiting
// human approval (scripts/review-explanations.ts) before being merged
// into cards.content — AI-generated explanations never reach the app
// unreviewed.
export const explanationSuggestions = pgTable('explanation_suggestions', {
  id: uuid('id').primaryKey().defaultRandom(),
  cardId: uuid('card_id').notNull().references(() => cards.id),

  distractorExplanations: jsonb('distractor_explanations').notNull(), // string[], parallel to content.options

  status: text('status').notNull().default('pending'), // 'pending' | 'approved' | 'rejected'

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
});
