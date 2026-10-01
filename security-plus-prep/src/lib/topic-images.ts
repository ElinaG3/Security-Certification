'use server';

import { del } from '@vercel/blob';
import { and, eq, desc } from 'drizzle-orm';
import { getDb } from '@/db';
import { topicImages } from '@/db/schema';
import { getCurrentUser } from './auth';
import { getActiveCertificationId } from './active-certification';

export type TopicImageRow = typeof topicImages.$inferSelect;

export async function listTopicImages(objective: string): Promise<TopicImageRow[]> {
  const user = await getCurrentUser();
  const db = getDb();
  const certificationId = await getActiveCertificationId();
  return db
    .select()
    .from(topicImages)
    .where(and(eq(topicImages.userId, user.id), eq(topicImages.certificationId, certificationId), eq(topicImages.objective, objective)))
    .orderBy(desc(topicImages.createdAt));
}

// Called after the browser has already uploaded the (resized) file directly
// to Blob storage (see app/api/topics/images/upload/route.ts) — this only
// ever receives a URL string + optional caption, never the image bytes.
export async function addTopicImage(objective: string, url: string, caption?: string): Promise<TopicImageRow> {
  const user = await getCurrentUser();
  const db = getDb();
  const certificationId = await getActiveCertificationId();
  const [row] = await db
    .insert(topicImages)
    .values({ userId: user.id, certificationId, objective, url, caption: caption?.trim() || null })
    .returning();
  return row;
}

async function requireOwnedImage(id: string): Promise<TopicImageRow> {
  const user = await getCurrentUser();
  const db = getDb();
  const [row] = await db.select().from(topicImages).where(eq(topicImages.id, id));
  if (!row || row.userId !== user.id) throw new Error('Image not found');
  return row;
}

export async function updateTopicImageCaption(id: string, caption: string): Promise<void> {
  await requireOwnedImage(id);
  const db = getDb();
  await db.update(topicImages).set({ caption: caption.trim() || null }).where(eq(topicImages.id, id));
}

export async function deleteTopicImage(id: string): Promise<void> {
  const row = await requireOwnedImage(id);
  const db = getDb();
  await db.delete(topicImages).where(eq(topicImages.id, id));
  try {
    await del(row.url);
  } catch {
    // The DB row is already gone (the thing the UI actually shows) — a
    // failed Blob delete just leaves an orphaned file, not a broken UI
    // state, so it's not worth failing the whole action over.
  }
}
