import { and, asc, eq, inArray, lte } from 'drizzle-orm';
import { getDb } from '@/db';
import { cards } from '@/db/schema';

export const DEFAULT_SESSION_SIZE = 15;
export const MIN_MULTI_SELECT_PER_SESSION = 4;

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

  return ensureMinMultiSelect(interleaved, due, limit);
}

// Domain-interleaving alone can leave a session with zero or one
// multiple_select card just because none happened to be due early in a
// domain's bucket — the composition guarantee (>= MIN_MULTI_SELECT per
// session) must not be left to that draw. If the interleaved queue is
// short on multiple_select cards, top it up from the full due pool by
// swapping into the least-urgent (tail-most) non-multiple_select slots,
// which minimizes disruption to the domain-interleaved ordering. This can
// only guarantee as many as are actually due — if fewer than
// MIN_MULTI_SELECT multiple_select cards are due system-wide, it tops up
// as many as it can and leaves the rest of the queue untouched.
function ensureMinMultiSelect(queue: CardRow[], due: CardRow[], limit: number): CardRow[] {
  const currentMsCount = queue.filter((c) => c.type === 'multiple_select').length;
  if (currentMsCount >= MIN_MULTI_SELECT_PER_SESSION) return queue;

  const queueIds = new Set(queue.map((c) => c.id));
  const extraMs = due
    .filter((c) => c.type === 'multiple_select' && !queueIds.has(c.id))
    .slice(0, MIN_MULTI_SELECT_PER_SESSION - currentMsCount);
  if (extraMs.length === 0) return queue;

  const result = [...queue];
  const swapIndices = result
    .map((c, i) => i)
    .filter((i) => result[i].type !== 'multiple_select')
    .reverse();

  for (const extra of extraMs) {
    const idx = swapIndices.shift();
    if (idx === undefined) break; // no more non-multiple_select slots to swap out
    result[idx] = extra;
  }

  return result.slice(0, limit);
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
