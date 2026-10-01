'use server';

import { eq, and } from 'drizzle-orm';
import { getDb } from '@/db';
import { topicStudySheets } from '@/db/schema';
import { getCurrentUser } from './auth';
import { getActiveCertificationId } from './active-certification';
import { generateStudySheet, sourceTextFromReading, computeSourceHash, type StudySheetContent } from './study-sheet-generation';
import { AI_MODELS } from './ai-models';
import type { ReadingSection } from './topics';

export interface StudySheetCacheEntry {
  content: StudySheetContent;
  sourceHash: string;
}

// Cheap read, no AI call — the server component uses this (plus its own
// hash of the CURRENT source text) to decide whether the client needs to
// trigger generation at all. "Later opens cost nothing" depends on this
// path never touching the Anthropic client.
export async function getCachedStudySheet(objective: string): Promise<StudySheetCacheEntry | null> {
  const db = getDb();
  const [user, certificationId] = await Promise.all([getCurrentUser(), getActiveCertificationId()]);
  const [row] = await db
    .select()
    .from(topicStudySheets)
    .where(and(eq(topicStudySheets.userId, user.id), eq(topicStudySheets.certificationId, certificationId), eq(topicStudySheets.objective, objective)));
  if (!row) return null;
  return { content: row.content as StudySheetContent, sourceHash: row.sourceHash };
}

export type StudySheetActionResult = { ok: true; sheet: StudySheetContent } | { ok: false; error: string };

// The one AI call — invoked client-side either automatically (no cache, or
// a stale cache) or via the confirmed "Regenerate" button. Always
// overwrites any existing cached row for this (user, cert, objective).
export async function generateAndCacheStudySheet(objective: string, readingSections: ReadingSection[]): Promise<StudySheetActionResult> {
  const user = await getCurrentUser();
  const db = getDb();
  const certificationId = await getActiveCertificationId();

  const sourceText = sourceTextFromReading(readingSections);
  if (sourceText.trim() === '') return { ok: false, error: 'No source material for this topic yet.' };
  const sourceHash = computeSourceHash(sourceText);

  let sheet: StudySheetContent;
  try {
    sheet = await generateStudySheet(sourceText, objective);
  } catch {
    return { ok: false, error: 'Could not generate the study sheet — try again.' };
  }

  const [existing] = await db
    .select({ id: topicStudySheets.id })
    .from(topicStudySheets)
    .where(and(eq(topicStudySheets.userId, user.id), eq(topicStudySheets.certificationId, certificationId), eq(topicStudySheets.objective, objective)));

  if (existing) {
    await db
      .update(topicStudySheets)
      .set({ content: sheet, sourceHash, model: AI_MODELS.content, updatedAt: new Date() })
      .where(eq(topicStudySheets.id, existing.id));
  } else {
    await db.insert(topicStudySheets).values({ userId: user.id, certificationId, objective, content: sheet, sourceHash, model: AI_MODELS.content });
  }

  return { ok: true, sheet };
}
