import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  real,
  jsonb,
  boolean,
  vector,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { EMBEDDING_DIMENSIONS } from '../lib/ai-models';
import { SY0_701_CERTIFICATION_ID } from '../lib/certifications';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),

  // Multi-certification refactor, Stage 3. Null = no selection made yet —
  // src/lib/active-certification.ts's getActiveCertificationId() falls
  // back to the fixed SY0-701 id in that case, so this column being unset
  // is a normal, valid state, not a data-quality gap.
  activeCertificationId: uuid('active_certification_id').references(() => certifications.id),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Multi-certification refactor, Stage 1 (schema + migrate SY0-701 data
// only — see scripts/seed-sy0-701-certification.ts). One row per
// certification the app can be pointed at; SY0-701 is seeded with a FIXED,
// well-known id (src/lib/certifications.ts) rather than defaultRandom() so
// existing insert call sites can reference it as a stable constant via a
// column DEFAULT, without needing any application code to change yet —
// Stage 2 replaces the constant/default with real "active certification"
// selection.
export const certifications = pgTable('certifications', {
  id: uuid('id').primaryKey(),
  name: text('name').notNull(),
  examCode: text('exam_code').notNull().unique(),
  domains: jsonb('domains').notNull(), // {name: string, targetWeight: number}[]
  config: jsonb('config').notNull(), // {sessionSize, minMultiSelect, difficultyMix}
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// One row per exam objective (e.g. "1.2"). `title` is nullable — official
// wording isn't available for every cert/objective yet (see
// src/lib/topics.ts's fallback-label handling), so this is filled in as
// real source material is ingested, not required upfront.
export const objectives = pgTable('objectives', {
  id: uuid('id').primaryKey().defaultRandom(),
  certificationId: uuid('certification_id').notNull().references(() => certifications.id),
  number: text('number').notNull(),
  title: text('title'),
  domain: text('domain').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// One row per uploaded source PDF (Home-restructure Step 2 — the Library).
// The file itself lives in Vercel Blob; this row is the certification-
// scoped catalog entry plus enough metadata (pageCount) for the in-app
// viewer's page-jump links (browser-native, via a `#page=N` URL fragment
// on the blob URL — no PDF.js needed).
export const pdfLibrary = pgTable('pdf_library', {
  id: uuid('id').primaryKey().defaultRandom(),
  certificationId: uuid('certification_id').notNull().references(() => certifications.id),
  filename: text('filename').notNull(),
  blobUrl: text('blob_url').notNull(),
  pageCount: integer('page_count').notNull(),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
});

// `type` + `content` form a discriminated union at the application layer
// (see src/db/question-types.ts) so new question types never require a migration.
export const cards = pgTable('cards', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),

  // Multi-certification refactor, Stage 1 — see src/lib/certifications.ts.
  // DEFAULT is the fixed SY0-701 id so this migration backfills every
  // existing row automatically; Stage 2+ drops the default once inserts
  // route through real active-certification selection instead.
  certificationId: uuid('certification_id')
    .notNull()
    .references(() => certifications.id)
    .default(SY0_701_CERTIFICATION_ID),

  domain: text('domain').notNull(),
  topic: text('topic').notNull(),

  // Which exam objectives version this card was authored/weighted against.
  // Lets SY0-801 (V8, expected ~Nov 2026) content coexist with SY0-701
  // without reworking the schema when that migration happens.
  examVersion: text('exam_version').notNull().default('SY0-701'),

  type: text('type').notNull(),
  content: jsonb('content').notNull(),

  // 'active' | 'pending' | 'rejected' — auto-generated cards land as 'pending'
  status: text('status').notNull().default('active'),

  // Independent of `status`: a lightweight "pull this out of rotation
  // without losing FSRS history" toggle, settable both mid-study (one
  // click while answering) and from the /review spot-check UI. getDueQueue
  // / getPbqWarmupQueue exclude flagged cards; nothing else about the card
  // changes, so unflagging fully restores it.
  flagged: boolean('flagged').notNull().default(false),
  flagNote: text('flag_note'),

  sourceType: text('source_type'), // 'manual' | 'pdf' | 'image' | 'note'
  sourceRef: text('source_ref'), // e.g. file id + page, or note id

  // Authoring metadata, populated for generated content only — null for the
  // legacy 135 seed cards. Distinct from `difficulty` above, which is
  // FSRS's algorithm-computed value, not an authored label.
  authoredDifficulty: text('authored_difficulty'), // 'recall' | 'application' | 'analysis'
  objective: text('objective'), // SY0-701 exam objective number, e.g. '2.4'

  // Paired-associate memory aid (e.g. "443/636/993/995 = 80/389/143/110 +
  // TLS") for arbitrary-recall content like ports or acronyms. Only
  // authoredDifficulty: 'recall' cards get one — scenario-style
  // application/analysis cards don't need this kind of aid. Shown to the
  // user only after they reveal a card's answer.
  mnemonic: text('mnemonic'),

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

  // Whether the user bypassed the post-submit elaboration gate (see
  // src/components/StudySession.tsx) via the skip shortcut instead of
  // waiting out the pause before revealing the answer. Defaults to false
  // for rows logged before this feature existed.
  elaborationSkipped: boolean('elaboration_skipped').notNull().default(false),

  // Whether this rep actually advanced FSRS scheduling (true) or was a
  // practice/warm-up rep on a card that wasn't due yet, logged for
  // visibility but excluded from the scheduler (false). Determined
  // server-side from the card's own due date at submit time — see
  // app/study/actions.ts. Defaults to true: every row logged before this
  // feature existed was a real scheduled rep.
  scheduled: boolean('scheduled').notNull().default(true),

  // Per-option/per-sub-question grading breakdown for PBQ types
  // (log_analysis, config_table, remediation_select) — null for
  // multiple_choice/multiple_select, which are fully described by
  // `rating` + the card's own content. Shape varies by question type; see
  // src/lib/pbq-grading.ts.
  subResults: jsonb('sub_results'),

  // Full FSRS-relevant card state as it was immediately BEFORE this review
  // was applied (state/due/stability/difficulty/elapsedDays/scheduledDays/
  // learningSteps/reps/lapses/lastReview) — NOT the same as the fields
  // above, which are ts-fsrs's own post-`next()` log shape and omit
  // reps/lapses entirely. Only this full snapshot lets a grading override
  // (see gradingOverrides below) correctly re-run scheduling "as if this
  // rep had been graded correctly" from the real prior state, rather than
  // from an already-downgraded one. Null for every review logged before
  // override support existed, and for review types override doesn't apply
  // to — populated only on typed-answer (fill_in) reviews.
  preReviewSnapshot: jsonb('pre_review_snapshot'),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Audit trail for the study-session "I was right" override on typed-answer
// (fill_in) grading: one row per correction, so a wrong-then-corrected
// grading is always visible in history rather than silently rewritten.
// The reviewLog row it corrects is never mutated (reviewLog is append-only
// — see its own comment above); the correction is a SEPARATE reviewLog
// row this override inserts, referenced here for the audit trail.
export const gradingOverrides = pgTable('grading_overrides', {
  id: uuid('id').primaryKey().defaultRandom(),
  reviewLogId: uuid('review_log_id').notNull().references(() => reviewLog.id), // the original WRONG-graded review being corrected
  correctionLogId: uuid('correction_log_id').references(() => reviewLog.id), // the new reviewLog row inserted for the corrected rep; null when the original rep wasn't due (nothing to reschedule)
  cardId: uuid('card_id').notNull().references(() => cards.id),
  userId: uuid('user_id').notNull().references(() => users.id),
  submittedAnswer: text('submitted_answer').notNull(), // what the user actually typed — added to the card's acceptedAnswers for exact-mode cards
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

// One row per extracted text chunk from a source PDF (scripts/ingest-pdf.ts).
// Embeddings are computed once at ingestion time with a local model
// (AI_MODELS.embedding) and reused to map each chunk to an exam objective
// and to skip chunks whose concept is already well covered by an active
// card — never a Claude call per chunk. Kept even after generation so a
// re-run of the same PDF doesn't re-embed or reconsider chunks it already
// used (usedForGeneration).
export const ingestedChunks = pgTable('ingested_chunks', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Multi-certification refactor, Stage 1 — see cards.certificationId above.
  certificationId: uuid('certification_id')
    .notNull()
    .references(() => certifications.id)
    .default(SY0_701_CERTIFICATION_ID),

  sourceFile: text('source_file').notNull(),
  examVersion: text('exam_version').notNull().default('SY0-701'),

  // Nullable: chunks ingested before the Library existed (the original CLI
  // path, reading a local file with no pdf_library row) have no pdf link —
  // still fully usable for search/generation, just without a "read this in
  // the Library" deep link. startPage/endPage are the page range the
  // chunk's text was actually extracted from (pdf-parse's per-page text),
  // for the viewer's #page=N jump.
  pdfId: uuid('pdf_id').references(() => pdfLibrary.id),
  startPage: integer('start_page'),
  endPage: integer('end_page'),

  objective: text('objective'), // e.g. '1.3', parsed from the source's own section headers
  sectionTitle: text('section_title'),
  subTopic: text('sub_topic'),
  content: text('content').notNull(),

  embedding: vector('embedding', { dimensions: EMBEDDING_DIMENSIONS }),
  // Highest cosine similarity found against any active card at ingestion
  // time — lets a later review ask "why was/wasn't this chunk used?"
  // without recomputing embeddings.
  maxCardSimilarity: real('max_card_similarity'),

  usedForGeneration: boolean('used_for_generation').notNull().default(false),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Free-recall attempts (Phase 6). Append-only — never updated or
// overwritten, one row per attempt, same convention as reviewLog — so
// recall accuracy over time on a topic is visible from real history, not
// a single mutable "latest score." Deliberately a SEPARATE signal from
// FSRS card retention (cards.stability/difficulty/reps): recognition
// (multiple-choice) and production (free recall) are different skills,
// and this table is never read by src/lib/fsrs.ts or blended into a
// card's schedule.
export const recallAttempts = pgTable('recall_attempts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),

  // Multi-certification refactor, Stage 1 — see cards.certificationId above.
  certificationId: uuid('certification_id')
    .notNull()
    .references(() => certifications.id)
    .default(SY0_701_CERTIFICATION_ID),

  // Nullable: a recall session can be started generically (all topics) as
  // well as scoped to one SY0-701 objective.
  objective: text('objective'),
  topic: text('topic').notNull(),

  // 'typed' (direct text entry) | 'handwritten' (image OCR'd, transcription
  // confirmed by the user, then graded like typed) | 'drawing_only' (just a
  // diagram, no text recall attempted — no grading, comments only).
  inputMode: text('input_mode').notNull(),

  rawText: text('raw_text'), // typed mode: what the user actually typed
  imageUrl: text('image_url'), // handwritten mode: the image OCR ran on
  transcription: text('transcription'), // handwritten mode: raw OCR output, before edits
  confirmedTranscription: text('confirmed_transcription'), // handwritten mode: what the user approved for grading

  // {correct: string[], missed: string[], errors: string[]} — null for
  // drawing_only (nothing was graded). score = correct.length /
  // (correct.length + missed.length), stored alongside so it doesn't need
  // recomputing from the JSON on every read.
  gapReport: jsonb('gap_report'),
  score: real('score'),

  // Independent of the above — a drawing (canvas or uploaded) never
  // produces a score, only qualitative vision comments. Can coexist with
  // any inputMode (e.g. typed recall + a supporting diagram) or be the
  // entire attempt (drawing_only).
  drawingUrl: text('drawing_url'),
  drawingComments: text('drawing_comments'),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Per (user, certification) profile settings — exam date feeds the home
// page countdown, dailyQuestionCount overrides the certification's own
// config.sessionSize default when set. Both nullable: "no exam date set"
// and "use the certification's default question count" are normal,
// unconfigured states, not missing data. One row per user+cert pair,
// upserted from src/lib/profile-settings.ts rather than enforced by a DB
// constraint (this app has exactly one user, so a race here isn't a real
// risk — same reasoning as users.activeCertificationId's plain update).
export const userCertificationSettings = pgTable('user_certification_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  certificationId: uuid('certification_id').notNull().references(() => certifications.id),
  examDate: timestamp('exam_date', { withTimezone: true }),
  dailyQuestionCount: integer('daily_question_count'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Guided Learning Session — Core (C1-C4). One row per (user, certification,
// calendar day in Europe/Berlin — see src/lib/day-boundary.ts) — the
// "one routine per day" rule is enforced by the unique index below, not
// just application logic. Each stage's input + AI feedback is stored as its
// own jsonb blob (same convention as recallAttempts.gapReport/cards.content)
// so reopening the page mid-routine can resume at `step` with everything
// already submitted still on screen — this app has no localStorage
// "resume" pattern anywhere else, so the DB row IS the resume state.
export const learningRoutineSessions = pgTable(
  'learning_routine_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id),
    certificationId: uuid('certification_id').notNull().references(() => certifications.id),
    dayKey: text('day_key').notNull(), // YYYY-MM-DD, Europe/Berlin

    status: text('status').notNull().default('in_progress'), // 'in_progress' | 'completed'
    step: text('step').notNull().default('start'), // 'start' | 'c1' | 'c2' | 'c3' | 'c4' | 'end'

    // Resolved once, when C1 starts — the topic the whole routine is about.
    topic: text('topic'),

    // { abcAnswers: Record<string,string>, freeRecallText: string, recallAttemptId: string | null, gapReport: GapReport, score: number }
    c1: jsonb('c1'),
    // { cardIds: string[] (the queue, fixed at C2 start), results: {cardId, userAnswer, correct, reviewLogId}[] }
    c2: jsonb('c2'),
    // { userErrorText: string, actualErrors: {source: 'c1'|'c2', text: string}[], forgotten: string[] }
    c3: jsonb('c3'),
    // { createdCardIds: string[], skippedErrorCount: number } — see routine.ts's 5-card cap
    c4: jsonb('c4'),

    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => [uniqueIndex('learning_routine_sessions_user_cert_day').on(t.userId, t.certificationId, t.dayKey)]
);

// Personal English->German glossary, built up from the floating word
// translator (any page). One row per (user, term) — a repeat lookup just
// bumps lookupCount/lastLookedUpAt instead of re-asking the AI, so this
// table is also a "don't re-translate what you already looked up" cache.
// Not scoped into the unique index by certification (a term is the same
// term regardless of which cert is active); certificationId is kept only
// as metadata about which cert was active at first lookup.
export const vocabTerms = pgTable(
  'vocab_terms',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id),
    certificationId: uuid('certification_id').references(() => certifications.id),

    term: text('term').notNull(), // normalized: trimmed + lowercased
    translationDe: text('translation_de').notNull(),
    contextNote: text('context_note').notNull(), // one short sentence: what it means in IT security / exam context

    lookupCount: integer('lookup_count').notNull().default(1),
    firstLookedUpAt: timestamp('first_looked_up_at', { withTimezone: true }).notNull().defaultNow(),
    lastLookedUpAt: timestamp('last_looked_up_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('vocab_terms_user_term').on(t.userId, t.term)]
);

// Free-text notes a user keeps per objective/topic (the topic page's "My
// notes" textarea) — separate from cards/recall/chunks, this is the
// learner's own writing, never AI-generated or graded. One row per
// (user, certification, objective).
export const topicNotes = pgTable('topic_notes', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  certificationId: uuid('certification_id').notNull().references(() => certifications.id),
  objective: text('objective').notNull(),
  content: text('content').notNull().default(''),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
