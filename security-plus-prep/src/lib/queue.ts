import { and, asc, eq, inArray, lte } from 'drizzle-orm';
import { getDb } from '@/db';
import { cards } from '@/db/schema';

export const DEFAULT_SESSION_SIZE = 15;

const PBQ_TYPES = ['log_analysis', 'config_table', 'remediation_select'] as const;

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

// Practice queue for PBQ types, regardless of due date — there are only a
// handful of seed cards per type, so the normal due-only queue won't
// reliably serve them. Safe by construction, not by convention: submitAnswer
// decides whether to actually schedule a rep from the card's own `due`
// column, not from the fact that it arrived via this queue.
export async function getPbqWarmupQueue({
  userId,
  limit = DEFAULT_SESSION_SIZE,
}: {
  userId: string;
  limit?: number;
}): Promise<CardRow[]> {
  const db = getDb();

  const rows = await db
    .select()
    .from(cards)
    .where(and(eq(cards.userId, userId), eq(cards.status, 'active'), inArray(cards.type, PBQ_TYPES)))
    .orderBy(asc(cards.due));

  const buckets = new Map<string, CardRow[]>();
  for (const card of rows) {
    const bucket = buckets.get(card.type) ?? [];
    bucket.push(card);
    buckets.set(card.type, bucket);
  }

  const typeQueues = [...buckets.values()];
  const interleaved: CardRow[] = [];
  let round = 0;
  while (interleaved.length < limit && typeQueues.some((q) => round < q.length)) {
    for (const q of typeQueues) {
      if (round < q.length) interleaved.push(q[round]);
      if (interleaved.length >= limit) break;
    }
    round++;
  }

  return interleaved;
}
