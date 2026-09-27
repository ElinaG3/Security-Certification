'use server';

import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { cards } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth';
import { checkCardConsistency } from '@/lib/card-consistency';
import type { MultipleChoiceContent, MultipleSelectContent } from '@/db/question-types';

// Spot-check tool over ACTIVE cards (batch generation auto-approves on a
// clean structural check — see check-card-consistency.ts / generate-gsc-
// cards.ts / ingest-pdf.ts — so most cards never see human eyes before
// going live) plus the small pending queue that check does still kick out
// (failed 3 auto-generation attempts). Both sections share the same
// edit/save path; only pending gets approve/reject.

export type ReviewCard = {
  id: string;
  domain: string;
  topic: string;
  type: 'multiple_choice' | 'multiple_select';
  status: string;
  flagged: boolean;
  flagNote: string | null;
  objective: string | null;
  sourceType: string | null;
  content: MultipleChoiceContent | MultipleSelectContent;
};

function toReviewCard(row: typeof cards.$inferSelect): ReviewCard {
  return {
    id: row.id,
    domain: row.domain,
    topic: row.topic,
    type: row.type as 'multiple_choice' | 'multiple_select',
    status: row.status,
    flagged: row.flagged,
    flagNote: row.flagNote,
    objective: row.objective,
    sourceType: row.sourceType,
    content: row.content as MultipleChoiceContent | MultipleSelectContent,
  };
}

export async function listPendingCards(): Promise<ReviewCard[]> {
  const user = await getCurrentUser();
  const db = getDb();
  const rows = await db
    .select()
    .from(cards)
    .where(and(eq(cards.userId, user.id), eq(cards.status, 'pending')))
    .orderBy(desc(cards.createdAt));
  return rows.filter((r) => r.type === 'multiple_choice' || r.type === 'multiple_select').map(toReviewCard);
}

const ACTIVE_PAGE_SIZE = 20;

export async function listActiveCards({
  domain,
  query,
  flaggedOnly,
  offset = 0,
}: {
  domain?: string;
  query?: string;
  flaggedOnly?: boolean;
  offset?: number;
}): Promise<{ cards: ReviewCard[]; total: number }> {
  const user = await getCurrentUser();
  const db = getDb();

  const trimmedQuery = query?.trim();
  const where = and(
    eq(cards.userId, user.id),
    eq(cards.status, 'active'),
    domain ? eq(cards.domain, domain) : undefined,
    flaggedOnly ? eq(cards.flagged, true) : undefined,
    trimmedQuery
      ? or(ilike(cards.topic, `%${trimmedQuery}%`), sql`${cards.content}::text ILIKE ${'%' + trimmedQuery + '%'}`)
      : undefined
  );

  const [rows, [{ count }]] = await Promise.all([
    db
      .select()
      .from(cards)
      .where(where)
      .orderBy(desc(cards.createdAt))
      .limit(ACTIVE_PAGE_SIZE)
      .offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(cards).where(where),
  ]);

  return {
    cards: rows.filter((r) => r.type === 'multiple_choice' || r.type === 'multiple_select').map(toReviewCard),
    total: count,
  };
}

export async function approveCard(id: string): Promise<void> {
  const user = await getCurrentUser();
  const db = getDb();
  const [row] = await db.select().from(cards).where(eq(cards.id, id));
  if (!row || row.userId !== user.id) throw new Error('Card not found');
  await db.update(cards).set({ status: 'active', updatedAt: new Date() }).where(eq(cards.id, id));
}

export async function rejectCard(id: string): Promise<void> {
  const user = await getCurrentUser();
  const db = getDb();
  const [row] = await db.select().from(cards).where(eq(cards.id, id));
  if (!row || row.userId !== user.id) throw new Error('Card not found');
  await db.update(cards).set({ status: 'rejected', updatedAt: new Date() }).where(eq(cards.id, id));
}

export async function setCardFlag(id: string, flagged: boolean, note?: string): Promise<void> {
  const user = await getCurrentUser();
  const db = getDb();
  const [row] = await db.select().from(cards).where(eq(cards.id, id));
  if (!row || row.userId !== user.id) throw new Error('Card not found');
  await db
    .update(cards)
    .set({ flagged, flagNote: flagged ? (note ?? row.flagNote) : null, updatedAt: new Date() })
    .where(eq(cards.id, id));
}

export type UpdateCardInput = {
  topic: string;
  question: string;
  options: string[];
  correct: number[]; // one entry for multiple_choice, requiredCount entries for multiple_select
  requiredCount?: number;
  explanation: string;
  distractorExplanations: string[];
};

export type UpdateCardResult = { ok: true } | { ok: false; issues: string[] };

export async function updateCardContent(id: string, input: UpdateCardInput): Promise<UpdateCardResult> {
  const user = await getCurrentUser();
  const db = getDb();
  const [row] = await db.select().from(cards).where(eq(cards.id, id));
  if (!row || row.userId !== user.id) throw new Error('Card not found');
  if (row.type !== 'multiple_choice' && row.type !== 'multiple_select') {
    throw new Error(`Editing is only supported for multiple_choice/multiple_select, got ${row.type}`);
  }

  const content =
    row.type === 'multiple_select'
      ? {
          question: input.question,
          options: input.options,
          correct: input.correct,
          requiredCount: input.requiredCount ?? input.correct.length,
          explanation: input.explanation,
          distractorExplanations: input.distractorExplanations,
        }
      : {
          question: input.question,
          options: input.options,
          correct: input.correct[0],
          explanation: input.explanation,
          distractorExplanations: input.distractorExplanations,
        };

  const issues = checkCardConsistency(content as any, row.type);
  if (input.options.length !== 4) issues.push(`expected exactly 4 options, got ${input.options.length}`);
  if (input.topic.trim() === '') issues.push('topic is required');
  if (input.question.trim() === '') issues.push('question is required');
  if (input.correct.length === 0) issues.push('at least one option must be marked correct');
  if (issues.length > 0) return { ok: false, issues };

  await db
    .update(cards)
    .set({ topic: input.topic, content, updatedAt: new Date() })
    .where(eq(cards.id, id));

  return { ok: true };
}
