import { and, asc, eq, lte } from 'drizzle-orm';
import { getDb } from '@/db';
import { cards } from '@/db/schema';

export const DEFAULT_SESSION_SIZE = 15;

type CardRow = typeof cards.$inferSelect;

// Interleaves due cards across domains by default (round-robin over
// per-domain buckets, each ordered by due date) so a session doesn't run
// through one domain before touching the next. Pass `domain` for focus mode,
// which just returns that domain's due cards in due-date order.
export async function getDueQueue({
  userId,
  domain,
  limit = DEFAULT_SESSION_SIZE,
  now = new Date(),
}: {
  userId: string;
  domain?: string;
  limit?: number;
  now?: Date;
}): Promise<CardRow[]> {
  const db = getDb();

  const due = await db
    .select()
    .from(cards)
    .where(
      and(
        eq(cards.userId, userId),
        eq(cards.status, 'active'),
        lte(cards.due, now),
        domain ? eq(cards.domain, domain) : undefined
      )
    )
    .orderBy(asc(cards.due));

  if (domain) return due.slice(0, limit);

  const buckets = new Map<string, CardRow[]>();
  for (const card of due) {
    const bucket = buckets.get(card.domain) ?? [];
    bucket.push(card);
    buckets.set(card.domain, bucket);
  }

  const domainQueues = [...buckets.values()];
  const interleaved: CardRow[] = [];
  let round = 0;
  while (interleaved.length < limit && domainQueues.some((q) => round < q.length)) {
    for (const q of domainQueues) {
      if (round < q.length) interleaved.push(q[round]);
      if (interleaved.length >= limit) break;
    }
    round++;
  }

  return interleaved;
}
