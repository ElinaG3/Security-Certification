'use server';

import { eq, and } from 'drizzle-orm';
import { getDb } from '@/db';
import { userCertificationSettings } from '@/db/schema';
import { getCurrentUser } from './auth';
import { getActiveCertificationId, getActiveCertification } from './active-certification';

export interface ProfileSettings {
  examDate: Date | null;
  dailyQuestionCount: number; // resolved: the user's own override, or the certification's default sessionSize
  dailyQuestionCountIsDefault: boolean; // true when no override is set — UI shows this distinctly from an explicit choice
}

export async function getProfileSettings(): Promise<ProfileSettings> {
  const db = getDb();
  const [user, certificationId, cert] = await Promise.all([getCurrentUser(), getActiveCertificationId(), getActiveCertification()]);
  const [row] = await db
    .select()
    .from(userCertificationSettings)
    .where(and(eq(userCertificationSettings.userId, user.id), eq(userCertificationSettings.certificationId, certificationId)));

  return {
    examDate: row?.examDate ?? null,
    dailyQuestionCount: row?.dailyQuestionCount ?? cert.config.sessionSize,
    dailyQuestionCountIsDefault: !row?.dailyQuestionCount,
  };
}

async function upsertSettings(fields: Partial<{ examDate: Date | null; dailyQuestionCount: number | null }>): Promise<void> {
  const db = getDb();
  const [user, certificationId] = await Promise.all([getCurrentUser(), getActiveCertificationId()]);
  const [existing] = await db
    .select()
    .from(userCertificationSettings)
    .where(and(eq(userCertificationSettings.userId, user.id), eq(userCertificationSettings.certificationId, certificationId)));

  if (existing) {
    await db
      .update(userCertificationSettings)
      .set({ ...fields, updatedAt: new Date() })
      .where(eq(userCertificationSettings.id, existing.id));
  } else {
    await db.insert(userCertificationSettings).values({ userId: user.id, certificationId, ...fields });
  }
}

export async function setExamDate(examDate: Date | null): Promise<void> {
  await upsertSettings({ examDate });
}

export async function setDailyQuestionCount(count: number | null): Promise<void> {
  await upsertSettings({ dailyQuestionCount: count });
}
