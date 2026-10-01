import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { and, asc, desc, eq, inArray, notInArray } from 'drizzle-orm';
import { getDb } from '@/db';
import { learningRoutineSessions, cards, reviewLog, recallAttempts } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth';
import { getActiveCertificationId, getActiveCertification } from '@/lib/active-certification';
import { todayKeyBerlin } from '@/lib/day-boundary';
import { getDueQueue } from '@/lib/queue';
import { AI_MODELS } from '@/lib/ai-models';
import { checkFillInConsistency } from '@/lib/card-consistency';
import type { GapReport } from '@/lib/recall-grading';
import type { FillInContent } from '@/db/question-types';

const client = new Anthropic();

export type RoutineStep = 'start' | 'c1' | 'c2' | 'c3' | 'c4' | 'end';
export type RoutineRow = typeof learningRoutineSessions.$inferSelect;

// Cap on how many mistakes get turned into cards per routine — C4 stays a
// quick end-of-session step, not an open-ended generation batch, and it
// keeps the per-routine Sonnet spend bounded. Anything past the cap is
// still visible in the C3 error log; it just doesn't get its own card.
export const MAX_MISTAKE_CARDS = 5;

export interface C1Data {
  abcAnswers: Record<string, string>;
  freeRecallText: string;
  recallAttemptId: string | null;
  gapReport: GapReport;
  score: number;
}

export interface C2Result {
  cardId: string;
  userAnswer: string;
  correct: boolean;
  reviewLogId: string | null;
}

export interface C2Data {
  cardIds: string[];
  results: C2Result[];
}

export interface RoutineError {
  source: 'c1' | 'c2';
  text: string;
}

export interface C3Data {
  userErrorText: string;
  actualErrors: RoutineError[];
  forgotten: string[]; // actualErrors[].text entries the user's own write-up didn't mention
}

export interface C4Data {
  createdCardIds: string[];
  skippedErrorCount: number;
}

async function getTodayRow(): Promise<RoutineRow | null> {
  const user = await getCurrentUser();
  const db = getDb();
  const certificationId = await getActiveCertificationId();
  const dayKey = todayKeyBerlin();
  const [row] = await db
    .select()
    .from(learningRoutineSessions)
    .where(
      and(
        eq(learningRoutineSessions.userId, user.id),
        eq(learningRoutineSessions.certificationId, certificationId),
        eq(learningRoutineSessions.dayKey, dayKey)
      )
    );
  return row ?? null;
}

// "Most recently studied topic" = the topic attached to whichever is more
// recent of: the last scheduled review (reviewLog ⋈ cards, both carry a
// `topic` string directly) or the last free-recall attempt (recallAttempts,
// same). topicNotes is left out deliberately — it only stores an objective
// number, not a topic label, and editing a note isn't really "studying" it
// the way answering cards or doing a recall attempt is.
async function resolveMostRecentTopic(userId: string, certificationId: string): Promise<string | null> {
  const db = getDb();
  const [reviewRows, recallRows] = await Promise.all([
    db
      .select({ topic: cards.topic, when: reviewLog.review })
      .from(reviewLog)
      .innerJoin(cards, eq(reviewLog.cardId, cards.id))
      .where(and(eq(reviewLog.userId, userId), eq(cards.certificationId, certificationId)))
      .orderBy(desc(reviewLog.review))
      .limit(1),
    db
      .select({ topic: recallAttempts.topic, when: recallAttempts.createdAt })
      .from(recallAttempts)
      .where(and(eq(recallAttempts.userId, userId), eq(recallAttempts.certificationId, certificationId)))
      .orderBy(desc(recallAttempts.createdAt))
      .limit(1),
  ]);

  const candidates = [...reviewRows, ...recallRows];
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.when.getTime() - a.when.getTime());
  return candidates[0].topic;
}

// Idempotent: returns today's row, creating it (with a resolved topic, if
// any) on first visit. The unique index on (user, certification, dayKey)
// is the real "one per day" guarantee; this just makes the common case a
// single round trip.
export async function getOrStartTodayRoutine(): Promise<RoutineRow> {
  const existing = await getTodayRow();
  if (existing) return existing;

  const user = await getCurrentUser();
  const db = getDb();
  const certificationId = await getActiveCertificationId();
  const topic = await resolveMostRecentTopic(user.id, certificationId);

  const [row] = await db
    .insert(learningRoutineSessions)
    .values({ userId: user.id, certificationId, dayKey: todayKeyBerlin(), topic })
    .onConflictDoNothing()
    .returning();

  // A concurrent request (e.g. two tabs) could lose the race above — fall
  // back to reading the row the other request just created.
  return row ?? (await getTodayRow())!;
}

export async function getTodayRoutineSummary(): Promise<{ completedToday: boolean; sessionId: string | null }> {
  const row = await getTodayRow();
  return { completedToday: row?.status === 'completed', sessionId: row?.id ?? null };
}

export async function requireOwnedRow(sessionId: string): Promise<RoutineRow> {
  const user = await getCurrentUser();
  const db = getDb();
  const [row] = await db.select().from(learningRoutineSessions).where(eq(learningRoutineSessions.id, sessionId));
  if (!row || row.userId !== user.id) throw new Error('Routine session not found');
  return row;
}

export async function setTopic(sessionId: string, topic: string): Promise<RoutineRow> {
  await requireOwnedRow(sessionId);
  const db = getDb();
  const [row] = await db
    .update(learningRoutineSessions)
    .set({ topic, step: 'c1' })
    .where(eq(learningRoutineSessions.id, sessionId))
    .returning();
  return row;
}

export async function advanceStep(sessionId: string, step: RoutineStep, patch: Partial<Pick<RoutineRow, 'c1' | 'c2' | 'c3' | 'c4'>>): Promise<RoutineRow> {
  await requireOwnedRow(sessionId);
  const db = getDb();
  const set: Partial<typeof learningRoutineSessions.$inferInsert> = { step, ...patch };
  if (step === 'end') {
    set.status = 'completed';
    set.completedAt = new Date();
  }
  const [row] = await db.update(learningRoutineSessions).set(set).where(eq(learningRoutineSessions.id, sessionId)).returning();
  return row;
}

// Due fill_in cards, topped up with the oldest not-yet-due/new fill_in
// cards if the due pool is short of `limit` — same "fewer than N due → fill
// with new/oldest" rule the spec calls for. Deliberately NOT scoped to the
// routine's own topic: "interleaved across topics" means pulling from the
// whole due pool, same as a normal /study session would.
export async function getC2Queue(limit: number): Promise<(typeof cards.$inferSelect)[]> {
  const user = await getCurrentUser();
  const db = getDb();
  const certificationId = await getActiveCertificationId();

  const due = await getDueQueue({ userId: user.id, types: ['fill_in'], limit });
  if (due.length >= limit) return due;

  const excludeIds = due.map((c) => c.id);
  const topUp = await db
    .select()
    .from(cards)
    .where(
      and(
        eq(cards.userId, user.id),
        eq(cards.certificationId, certificationId),
        eq(cards.status, 'active'),
        eq(cards.flagged, false),
        eq(cards.type, 'fill_in'),
        excludeIds.length > 0 ? notInArray(cards.id, excludeIds) : undefined
      )
    )
    .orderBy(asc(cards.createdAt))
    .limit(limit - due.length);

  return [...due, ...topUp];
}

// Merges C1's gap report (missed + factually-wrong points) with C2's wrong
// cards into one ordered list — C1 gaps first, since those are the
// session's actual new-material errors; C2 is reinforcement of older cards.
export function computeErrorList(c1: C1Data | null, c2Results: C2Result[], c2Cards: (typeof cards.$inferSelect)[]): RoutineError[] {
  const errors: RoutineError[] = [];
  if (c1) {
    for (const text of c1.gapReport.missed) errors.push({ source: 'c1', text: `Missed: ${text}` });
    for (const text of c1.gapReport.errors) errors.push({ source: 'c1', text: `Got wrong: ${text}` });
  }
  const cardById = new Map(c2Cards.map((c) => [c.id, c]));
  for (const result of c2Results) {
    if (result.correct) continue;
    const card = cardById.get(result.cardId);
    const content = card?.content as FillInContent | undefined;
    if (!content) continue;
    errors.push({ source: 'c2', text: `"${content.question}" — you answered "${result.userAnswer || '(blank)'}"` });
  }
  return errors;
}

const mistakeCardTool: Anthropic.Tool = {
  name: 'submit_mistake_card',
  description: 'Write one typed-answer practice question targeting a specific thing the learner just got wrong or missed.',
  input_schema: {
    type: 'object',
    properties: {
      gradingMode: { type: 'string', enum: ['exact', 'ai'], description: '"exact" for a single short-answer fact, "ai" for a 1-2 sentence explanation question' },
      question: { type: 'string' },
      acceptedAnswers: {
        type: 'array',
        items: { type: 'string' },
        description: 'For "exact": 1-3 true-equivalent literal answers. For "ai": 2-4 short key-point phrases the answer should cover.',
      },
      explanation: { type: 'string', description: '1-2 sentences: why this is the answer' },
    },
    required: ['gradingMode', 'question', 'acceptedAnswers', 'explanation'],
  },
};

async function generateMistakeCardContent(error: RoutineError, topic: string): Promise<FillInContent> {
  const cert = await getActiveCertification();
  const response = await client.messages.create({
    model: AI_MODELS.content,
    max_tokens: 1024,
    tools: [mistakeCardTool],
    tool_choice: { type: 'tool', name: 'submit_mistake_card' },
    messages: [
      {
        role: 'user',
        content: `${cert.name} (${cert.examCode}) — the learner just studied the topic "${topic}" and this came up as something they got wrong or missed: "${error.text}". Write ONE typed-answer practice question that specifically targets this gap (not the topic in general) so reviewing it later will actually close it. Call submit_mistake_card.`,
      },
    ],
  });

  const toolUse = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
  if (!toolUse) throw new Error('No tool_use block in mistake-card response');
  const parsed = z
    .object({
      gradingMode: z.enum(['exact', 'ai']),
      question: z.string(),
      acceptedAnswers: z.array(z.string()).min(1),
      explanation: z.string(),
    })
    .parse(toolUse.input);

  return parsed;
}

// Neither domain nor exam objective is stored on the routine session
// itself — both are looked up from any existing card that already carries
// this topic string (same fallback generate-fillin-cards.ts uses for an
// unmapped objective; objective is nullable exactly like on `cards`).
export async function resolveDomainAndObjectiveForTopic(topic: string, certificationId: string): Promise<{ domain: string; objective: string | null }> {
  const db = getDb();
  const [row] = await db
    .select({ domain: cards.domain, objective: cards.objective })
    .from(cards)
    .where(and(eq(cards.certificationId, certificationId), eq(cards.topic, topic)))
    .limit(1);
  return { domain: row?.domain ?? 'Unknown', objective: row?.objective ?? null };
}

// Generates at most MAX_MISTAKE_CARDS cards, prioritizing C1 gaps over C2
// wrong-answers (computeErrorList already orders them that way). Same
// auto-approve-on-structural-pass policy as scripts/generate-fillin-cards.ts
// — a card that fails checkFillInConsistency lands 'pending' for /review
// rather than being silently dropped or force-approved.
export async function generateMistakeCards(topic: string, errors: RoutineError[]): Promise<C4Data> {
  const user = await getCurrentUser();
  const db = getDb();
  const certificationId = await getActiveCertificationId();
  const { domain } = await resolveDomainAndObjectiveForTopic(topic, certificationId);

  const selected = errors.slice(0, MAX_MISTAKE_CARDS);
  const skippedErrorCount = Math.max(0, errors.length - MAX_MISTAKE_CARDS);

  const createdCardIds: string[] = [];
  for (const error of selected) {
    const generated = await generateMistakeCardContent(error, topic);
    const content: FillInContent = {
      question: generated.question,
      gradingMode: generated.gradingMode,
      acceptedAnswers: generated.acceptedAnswers,
      explanation: generated.explanation,
    };
    const issues = checkFillInConsistency(content);
    const [row] = await db
      .insert(cards)
      .values({
        userId: user.id,
        certificationId,
        domain,
        topic,
        type: 'fill_in',
        content,
        status: issues.length === 0 ? 'active' : 'pending',
        sourceType: 'routine_mistake',
      })
      .returning({ id: cards.id });
    createdCardIds.push(row.id);
  }

  return { createdCardIds, skippedErrorCount };
}

// For the "first time ever → let me pick a topic instead" fallback when
// resolveMostRecentTopic finds no history at all.
export async function listAllTopics(): Promise<{ domain: string; topic: string }[]> {
  const user = await getCurrentUser();
  const db = getDb();
  const certificationId = await getActiveCertificationId();
  const rows = await db
    .selectDistinct({ domain: cards.domain, topic: cards.topic })
    .from(cards)
    .where(and(eq(cards.userId, user.id), eq(cards.certificationId, certificationId), eq(cards.status, 'active')));
  return rows.sort((a, b) => a.domain.localeCompare(b.domain) || a.topic.localeCompare(b.topic));
}

export async function getCardsByIds(ids: string[]): Promise<(typeof cards.$inferSelect)[]> {
  if (ids.length === 0) return [];
  const db = getDb();
  return db.select().from(cards).where(inArray(cards.id, ids));
}

// Appends one graded C2 answer to the session's fixed queue and, once every
// card in the queue has a result, advances straight to C3 — C2 has no
// separate "submit" step of its own, unlike C1/C3.
export async function appendC2Result(sessionId: string, result: C2Result): Promise<{ row: RoutineRow; allDone: boolean }> {
  const current = await requireOwnedRow(sessionId);
  const c2 = current.c2 as C2Data;
  const results = [...c2.results, result];
  const allDone = results.length >= c2.cardIds.length;
  const row = await advanceStep(sessionId, allDone ? 'c3' : 'c2', { c2: { ...c2, results } });
  return { row, allDone };
}

// "I was right" override for a C2 card corrects the reviewLog, but the
// session's own C2 result also needs flipping to correct=true so the C3
// error log (built from these results) doesn't still call it an error.
export async function markC2ResultCorrected(sessionId: string, reviewLogId: string): Promise<void> {
  const current = await requireOwnedRow(sessionId);
  const c2 = current.c2 as C2Data;
  const results = c2.results.map((r) => (r.reviewLogId === reviewLogId ? { ...r, correct: true } : r));
  const db = getDb();
  await db.update(learningRoutineSessions).set({ c2: { ...c2, results } }).where(eq(learningRoutineSessions.id, sessionId));
}

function normalizeForMatch(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

const ERROR_LOG_STOPWORDS = new Set([
  'missed', 'got', 'wrong', 'you', 'answered', 'blank', 'the', 'a', 'an', 'and', 'or', 'to', 'of', 'in', 'on', 'for', 'with', 'is', 'are', 'was', 'were', 'this', 'that',
]);

function keyTerms(text: string): string[] {
  return normalizeForMatch(text)
    .split(' ')
    .filter((w) => w.length >= 5 && !ERROR_LOG_STOPWORDS.has(w));
}

// Not AI — a plain keyword-containment check against the user's own
// free-text error log, same spirit as the string-normalize pass in
// fill-in-grading.ts (cheap, deterministic, no runtime AI call needed for
// something this simple). An error "counts" as written down if at least
// one of its distinguishing (5+ letter, non-stopword) terms shows up
// anywhere in what the user wrote — genuinely missing every such term is
// what "highlight the ones I forgot" is meant to catch.
export function computeForgotten(userErrorText: string, actualErrors: RoutineError[]): string[] {
  const userNorm = normalizeForMatch(userErrorText);
  return actualErrors
    .filter((e) => {
      const terms = keyTerms(e.text);
      return terms.length > 0 && !terms.some((t) => userNorm.includes(t));
    })
    .map((e) => e.text);
}
