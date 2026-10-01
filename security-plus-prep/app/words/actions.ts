'use server';

import { and, eq, desc } from 'drizzle-orm';
import { getDb } from '@/db';
import { vocabTerms } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth';
import { getActiveCertificationId } from '@/lib/active-certification';
import { translateTerm } from '@/lib/vocab-translation';

export type VocabTermRow = typeof vocabTerms.$inferSelect;

const MAX_TERM_LENGTH = 60;

function normalizeTerm(raw: string): string {
  return raw.trim().toLowerCase();
}

export type LookupResult = { ok: true; term: VocabTermRow; isNew: boolean } | { ok: false; error: string };

// Existing term -> just bumps lookupCount/lastLookedUpAt, no AI call. New
// term -> one Haiku call (translateTerm), then insert. AI failure inserts
// nothing and reports a short error, rather than a half-written row.
export async function lookupTerm(input: string): Promise<LookupResult> {
  const term = normalizeTerm(input);
  if (term === '') return { ok: false, error: 'Type a word first.' };
  if (term.length > MAX_TERM_LENGTH) return { ok: false, error: `That's too long for one term (${MAX_TERM_LENGTH} characters max).` };

  const user = await getCurrentUser();
  const db = getDb();

  const [existing] = await db.select().from(vocabTerms).where(and(eq(vocabTerms.userId, user.id), eq(vocabTerms.term, term)));
  if (existing) {
    const [updated] = await db
      .update(vocabTerms)
      .set({ lookupCount: existing.lookupCount + 1, lastLookedUpAt: new Date() })
      .where(eq(vocabTerms.id, existing.id))
      .returning();
    return { ok: true, term: updated, isNew: false };
  }

  let translation;
  try {
    translation = await translateTerm(term);
  } catch {
    return { ok: false, error: 'Translation failed — try again in a moment.' };
  }

  const certificationId = await getActiveCertificationId();
  const [inserted] = await db
    .insert(vocabTerms)
    .values({
      userId: user.id,
      certificationId,
      term,
      translationDe: translation.translationDe,
      contextNote: translation.contextNote,
    })
    .returning();

  return { ok: true, term: inserted, isNew: true };
}

export async function listTerms(sort: 'most_looked_up' | 'newest' = 'most_looked_up'): Promise<VocabTermRow[]> {
  const user = await getCurrentUser();
  const db = getDb();
  return db
    .select()
    .from(vocabTerms)
    .where(eq(vocabTerms.userId, user.id))
    .orderBy(sort === 'newest' ? desc(vocabTerms.firstLookedUpAt) : desc(vocabTerms.lookupCount));
}

export async function deleteTerm(id: string): Promise<void> {
  const user = await getCurrentUser();
  const db = getDb();
  const [row] = await db.select().from(vocabTerms).where(eq(vocabTerms.id, id));
  if (!row || row.userId !== user.id) throw new Error('Term not found');
  await db.delete(vocabTerms).where(eq(vocabTerms.id, id));
}
