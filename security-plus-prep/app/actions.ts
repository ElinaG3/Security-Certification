'use server';

import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { users } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth';

// Persists the switcher's selection on the user row (survives reloads,
// unlike a client-only state or a browser-scoped cookie) — every live read
// path already resolves the active certification through
// src/lib/active-certification.ts's getActiveCertificationId(), which
// reads this same column, so this one write is the entire mechanism.
export async function setActiveCertification(certificationId: string): Promise<void> {
  const user = await getCurrentUser();
  const db = getDb();
  await db.update(users).set({ activeCertificationId: certificationId }).where(eq(users.id, user.id));
}
