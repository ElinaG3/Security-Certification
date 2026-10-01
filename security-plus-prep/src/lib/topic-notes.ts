'use server';

import { eq, and } from 'drizzle-orm';
import { getDb } from '@/db';
import { topicNotes } from '@/db/schema';
import { getCurrentUser } from './auth';
import { getActiveCertificationId } from './active-certification';

export async function getTopicNote(objective: string): Promise<string> {
  const db = getDb();
  const [user, certificationId] = await Promise.all([getCurrentUser(), getActiveCertificationId()]);
  const [row] = await db
    .select({ content: topicNotes.content })
    .from(topicNotes)
    .where(and(eq(topicNotes.userId, user.id), eq(topicNotes.certificationId, certificationId), eq(topicNotes.objective, objective)));
  return row?.content ?? '';
}

export async function saveTopicNote(objective: string, content: string): Promise<void> {
  const db = getDb();
  const [user, certificationId] = await Promise.all([getCurrentUser(), getActiveCertificationId()]);
  const [existing] = await db
    .select({ id: topicNotes.id })
    .from(topicNotes)
    .where(and(eq(topicNotes.userId, user.id), eq(topicNotes.certificationId, certificationId), eq(topicNotes.objective, objective)));

  if (existing) {
    await db.update(topicNotes).set({ content, updatedAt: new Date() }).where(eq(topicNotes.id, existing.id));
  } else {
    await db.insert(topicNotes).values({ userId: user.id, certificationId, objective, content });
  }
}
