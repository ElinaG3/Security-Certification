import { cache } from 'react';
import { getDb } from '@/db';
import { users } from '@/db/schema';

// Auth stub for v1: single-user only. Every query in the app still goes
// through a real user_id (see schema.ts), so adding real multi-user auth
// later means swapping this function's body for a session lookup — no
// schema or query changes required anywhere else.
//
// cache()'d (Stage 3 of the multi-cert refactor made this worth doing —
// getActiveCertificationId() now calls this on every use, and it's used
// pervasively) so multiple calls within one request/render share a single
// DB round trip instead of each re-querying "SELECT * FROM users LIMIT 1".
export const getCurrentUser = cache(async () => {
  const db = getDb();
  const [user] = await db.select().from(users).limit(1);
  if (!user) {
    throw new Error('No user found — run `npm run db:seed` first.');
  }
  return user;
});
