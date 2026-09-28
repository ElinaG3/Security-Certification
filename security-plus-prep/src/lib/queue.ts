import { and, asc, eq, inArray, lte } from 'drizzle-orm';
import { getDb } from '@/db';
import { cards } from '@/db/schema';
import { getActiveCertificationId, getActiveCertification } from './active-certification';

const PBQ_TYPES = ['log_analysis', 'config_table', 'remediation_select'] as const;

type CardRow = typeof cards.$inferSelect;

// Interleaves due cards across domains by default (round-robin over
// per-domain buckets, each ordered by due date) so a session doesn't run
// through one domain before touching the next. Pass `domain` for focus
// mode, or `objective` for a single-topic focus (e.g. "Practice this
// topic's cards" from the topic page) — either just returns the filtered
// due cards in due-date order, same as each other.
//
// `limit` defaults to the active certification's own config.sessionSize
// (not a hardcoded constant) when omitted — same for minMultiSelect below.
export async function getDueQueue({
  userId,
  domain,
  objective,
  limit,
  now = new Date(),
}: {
  userId: string;
  domain?: string;
  objective?: string;
  limit?: number;
  now?: Date;
}): Promise<CardRow[]> {
  const db = getDb();
  const [certificationId, cert] = await Promise.all([getActiveCertificationId(), getActiveCertification()]);
  const effectiveLimit = limit ?? cert.config.sessionSize;

  const due = await db
    .select()
    .from(cards)
    .where(
      and(
        eq(cards.userId, userId),
        eq(cards.certificationId, certificationId),
        eq(cards.status, 'active'),
        eq(cards.flagged, false),
        lte(cards.due, now),
        domain ? eq(cards.domain, domain) : undefined,
        objective ? eq(cards.objective, objective) : undefined
      )
    )
    .orderBy(asc(cards.due));

  if (domain || objective) return due.slice(0, effectiveLimit);

  const buckets = new Map<string, CardRow[]>();
  for (const card of due) {
    const bucket = buckets.get(card.domain) ?? [];
    bucket.push(card);
    buckets.set(card.domain, bucket);
  }

  const domainQueues = [...buckets.values()];
  const interleaved: CardRow[] = [];
  let round = 0;
  while (interleaved.length < effectiveLimit && domainQueues.some((q) => round < q.length)) {
    for (const q of domainQueues) {
      if (round < q.length) interleaved.push(q[round]);
      if (interleaved.length >= effectiveLimit) break;
    }
    round++;
  }

  // Applied in sequence, each protecting every type already guaranteed by
  // an earlier pass from being swapped back out — otherwise satisfying
  // minFillIn could silently undo minMultiSelect's guarantee (and vice
  // versa if the order were reversed).
  const withMinMs = ensureMinOfType(interleaved, due, effectiveLimit, cert.config.minMultiSelect, 'multiple_select', []);
  return ensureMinOfType(withMinMs, due, effectiveLimit, cert.config.minFillIn ?? 0, 'fill_in', ['multiple_select']);
}

// Domain-interleaving alone can leave a session with zero or one card of a
// given type just because none happened to be due early in a domain's
// bucket — a composition guarantee (>= minCount of `type` per session)
// must not be left to that draw. If the interleaved queue is short, top
// it up from the full due pool by swapping into the least-urgent
// (tail-most) slot of any type NOT in `protectedTypes` (never `type`
// itself, and never a type an earlier guarantee already secured), which
// minimizes disruption to the domain-interleaved ordering. This can only
// guarantee as many as are actually due — if fewer than minCount cards of
// `type` are due system-wide, it tops up as many as it can and leaves the
// rest of the queue untouched.
function ensureMinOfType(queue: CardRow[], due: CardRow[], limit: number, minCount: number, type: string, protectedTypes: string[]): CardRow[] {
  const currentCount = queue.filter((c) => c.type === type).length;
  if (currentCount >= minCount) return queue;

  const queueIds = new Set(queue.map((c) => c.id));
  const extra = due.filter((c) => c.type === type && !queueIds.has(c.id)).slice(0, minCount - currentCount);
  if (extra.length === 0) return queue;

  const result = [...queue];
  const nonSwappable = new Set([type, ...protectedTypes]);
  const swapIndices = result
    .map((c, i) => i)
    .filter((i) => !nonSwappable.has(result[i].type))
    .reverse();

  for (const item of extra) {
    const idx = swapIndices.shift();
    if (idx === undefined) break; // no more swappable slots left
    result[idx] = item;
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
  limit,
}: {
  userId: string;
  limit?: number;
}): Promise<CardRow[]> {
  const db = getDb();
  const [certificationId, cert] = await Promise.all([getActiveCertificationId(), getActiveCertification()]);
  const effectiveLimit = limit ?? cert.config.sessionSize;

  const rows = await db
    .select()
    .from(cards)
    .where(
      and(
        eq(cards.userId, userId),
        eq(cards.certificationId, certificationId),
        eq(cards.status, 'active'),
        eq(cards.flagged, false),
        inArray(cards.type, PBQ_TYPES)
      )
    )
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
  while (interleaved.length < effectiveLimit && typeQueues.some((q) => round < q.length)) {
    for (const q of typeQueues) {
      if (round < q.length) interleaved.push(q[round]);
      if (interleaved.length >= effectiveLimit) break;
    }
    round++;
  }

  return interleaved;
}
