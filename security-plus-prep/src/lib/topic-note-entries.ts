'use server';

import { and, eq, desc } from 'drizzle-orm';
import { getDb } from '@/db';
import { topicNoteEntries, topicNotes } from '@/db/schema';
import { getCurrentUser } from './auth';
import { getActiveCertificationId } from './active-certification';

export type NoteEntry = typeof topicNoteEntries.$inferSelect;

const MAX_LENGTH = 2000;

// Reads the entry list, backfilling ONCE from the legacy single-textarea
// topicNotes row the first time a topic with old note text but zero
// entries is opened — idempotent (only fires when entries are still
// empty), and topicNotes itself is never deleted or mutated.
export async function listNotes(objective: string): Promise<NoteEntry[]> {
  const user = await getCurrentUser();
  const db = getDb();
  const certificationId = await getActiveCertificationId();

  const existing = await db
    .select()
    .from(topicNoteEntries)
    .where(and(eq(topicNoteEntries.userId, user.id), eq(topicNoteEntries.certificationId, certificationId), eq(topicNoteEntries.objective, objective)))
    .orderBy(desc(topicNoteEntries.createdAt));
  if (existing.length > 0) return existing;

  const [legacy] = await db
    .select()
    .from(topicNotes)
    .where(and(eq(topicNotes.userId, user.id), eq(topicNotes.certificationId, certificationId), eq(topicNotes.objective, objective)));
  if (legacy && legacy.content.trim() !== '') {
    const [inserted] = await db
      .insert(topicNoteEntries)
      .values({ userId: user.id, certificationId, objective, body: legacy.content.trim() })
      .returning();
    return [inserted];
  }

  return [];
}

export type NoteActionResult = { ok: true; note: NoteEntry } | { ok: false; error: string };

function validateBody(body: string): { ok: true; trimmed: string } | { ok: false; error: string } {
  const trimmed = body.trim();
  if (trimmed === '') return { ok: false, error: 'Note cannot be empty.' };
  if (trimmed.length > MAX_LENGTH) return { ok: false, error: `Note is too long (${MAX_LENGTH} characters max).` };
  return { ok: true, trimmed };
}

export async function addNote(objective: string, body: string): Promise<NoteActionResult> {
  const validated = validateBody(body);
  if (!validated.ok) return validated;

  const user = await getCurrentUser();
  const db = getDb();
  const certificationId = await getActiveCertificationId();
  const [row] = await db
    .insert(topicNoteEntries)
    .values({ userId: user.id, certificationId, objective, body: validated.trimmed })
    .returning();
  return { ok: true, note: row };
}

async function requireOwnedNote(id: string): Promise<NoteEntry> {
  const user = await getCurrentUser();
  const db = getDb();
  const [row] = await db.select().from(topicNoteEntries).where(eq(topicNoteEntries.id, id));
  if (!row || row.userId !== user.id) throw new Error('Note not found');
  return row;
}

export async function updateNote(id: string, body: string): Promise<NoteActionResult> {
  await requireOwnedNote(id);
  const validated = validateBody(body);
  if (!validated.ok) return validated;

  const db = getDb();
  const [row] = await db
    .update(topicNoteEntries)
    .set({ body: validated.trimmed, updatedAt: new Date() })
    .where(eq(topicNoteEntries.id, id))
    .returning();
  return { ok: true, note: row };
}

export async function deleteNote(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireOwnedNote(id);
  const db = getDb();
  await db.delete(topicNoteEntries).where(eq(topicNoteEntries.id, id));
  return { ok: true };
}
