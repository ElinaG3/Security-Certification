import { and, eq, isNotNull } from 'drizzle-orm';
import { getDb } from '@/db';
import { cards, reviewLog, recallAttempts } from '@/db/schema';
import { computeRetrievability } from './fsrs';
import { getActiveCertificationId, getActiveDomains, getActiveDomainWeights, getActiveObjectives } from './active-certification';
import { objectiveLabels } from './topics';

// A card/topic "counts" toward retention only once it's actually been
// reviewed (computeRetrievability returns null otherwise) — never
// defaulted to 0% or 100%, which would misrepresent unstudied material as
// either failing or mastered.
export const WEAK_THRESHOLD = 0.6; // 60% — below this, retention or recall accuracy is surfaced as weak

export interface StudyStats {
  cardsStudied: number;
  totalActiveCards: number;
  currentStreak: number;
  studyDays: number;
  // Flat average of computeRetrievability() across every studied
  // (reps > 0) card, regardless of domain — "if you sat down right now,
  // about how much of what you've studied would you likely still get
  // right." null when nothing's been studied yet (never faked as 0 or
  // 100). This is the plain-language summary line's second number.
  overallRetention: number | null;
}

export async function getStudyStats(userId: string): Promise<StudyStats> {
  const db = getDb();
  const certificationId = await getActiveCertificationId();
  const [activeCards, reviewDates] = await Promise.all([
    db
      .select()
      .from(cards)
      .where(and(eq(cards.userId, userId), eq(cards.certificationId, certificationId), eq(cards.status, 'active'))),
    // review_log has no certification_id of its own — it inherits scope via
    // its card, so this joins through cards to filter to the active cert.
    db
      .select({ review: reviewLog.review })
      .from(reviewLog)
      .innerJoin(cards, eq(reviewLog.cardId, cards.id))
      .where(and(eq(reviewLog.userId, userId), eq(cards.certificationId, certificationId))),
  ]);

  const studiedCards = activeCards.filter((c) => c.reps > 0);
  const cardsStudied = studiedCards.length;

  let retentionSum = 0;
  let retentionCount = 0;
  for (const card of studiedCards) {
    const r = computeRetrievability(card);
    if (r !== null) {
      retentionSum += r;
      retentionCount++;
    }
  }
  const overallRetention = retentionCount > 0 ? retentionSum / retentionCount : null;

  // Distinct calendar dates (UTC) with at least one review — good enough
  // for a personal single-user app; not attempting per-user timezone
  // handling, which nothing else in this app does either.
  const dateSet = new Set(reviewDates.map((r) => r.review.toISOString().slice(0, 10)));
  const studyDays = dateSet.size;

  let currentStreak = 0;
  if (dateSet.size > 0) {
    const cursor = new Date();
    cursor.setUTCHours(0, 0, 0, 0);
    // Streak stays "alive" through today even if today has no review yet —
    // only breaks once a full day is skipped.
    if (!dateSet.has(cursor.toISOString().slice(0, 10))) {
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    }
    while (dateSet.has(cursor.toISOString().slice(0, 10))) {
      currentStreak++;
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    }
  }

  return { cardsStudied, totalActiveCards: activeCards.length, currentStreak, studyDays, overallRetention };
}

export interface DomainRetention {
  domain: string;
  retention: number | null; // null = nothing reviewed yet in this domain
  reviewedCount: number;
  totalCount: number;
  targetWeight: number;
}

export async function getDomainRetention(userId: string): Promise<DomainRetention[]> {
  const db = getDb();
  const [certificationId, domains, weights] = await Promise.all([
    getActiveCertificationId(),
    getActiveDomains(),
    getActiveDomainWeights(),
  ]);
  const rows = await db
    .select()
    .from(cards)
    .where(and(eq(cards.userId, userId), eq(cards.certificationId, certificationId), eq(cards.status, 'active')));

  const byDomain = new Map<string, { sum: number; reviewed: number; total: number }>();
  for (const domain of domains) byDomain.set(domain, { sum: 0, reviewed: 0, total: 0 });

  for (const row of rows) {
    const bucket = byDomain.get(row.domain);
    if (!bucket) continue; // a domain string that isn't one of the active cert's own — skip rather than guess
    bucket.total++;
    const r = computeRetrievability(row);
    if (r !== null) {
      bucket.sum += r;
      bucket.reviewed++;
    }
  }

  return domains.map((domain) => {
    const b = byDomain.get(domain)!;
    return {
      domain,
      retention: b.reviewed > 0 ? b.sum / b.reviewed : null,
      reviewedCount: b.reviewed,
      totalCount: b.total,
      targetWeight: weights[domain],
    };
  });
}

export interface DomainRecallAccuracy {
  domain: string;
  accuracy: number | null; // null = no graded recall attempts yet in this domain
  attemptCount: number;
}

export async function getDomainRecallAccuracy(userId: string): Promise<DomainRecallAccuracy[]> {
  const db = getDb();
  const [certificationId, domains, objectivesList] = await Promise.all([
    getActiveCertificationId(),
    getActiveDomains(),
    getActiveObjectives(),
  ]);
  const domainByObjective = new Map(objectivesList.map((o) => [o.number, o.domain]));

  const rows = await db
    .select({ objective: recallAttempts.objective, score: recallAttempts.score })
    .from(recallAttempts)
    .where(and(eq(recallAttempts.userId, userId), eq(recallAttempts.certificationId, certificationId), isNotNull(recallAttempts.score)));

  const byDomain = new Map<string, { sum: number; count: number }>();
  for (const domain of domains) byDomain.set(domain, { sum: 0, count: 0 });

  for (const row of rows) {
    if (!row.objective || row.score === null) continue;
    const domain = domainByObjective.get(row.objective);
    if (!domain) continue;
    const bucket = byDomain.get(domain);
    if (!bucket) continue;
    bucket.sum += row.score;
    bucket.count++;
  }

  return domains.map((domain) => {
    const b = byDomain.get(domain)!;
    return { domain, accuracy: b.count > 0 ? b.sum / b.count : null, attemptCount: b.count };
  });
}

export interface TopicLearningProgress {
  objective: string;
  domain: string;
  label: string;
  learnedCount: number;
  totalCount: number;
}

export interface DomainLearningProgress {
  domain: string;
  targetWeight: number;
  learnedCount: number;
  totalCount: number;
  topics: TopicLearningProgress[];
}

// "Learned" = reviewed at least once (reps > 0) AND current FSRS
// retrievability >= 0.8 — the home page's single progress metric, chosen
// over a plain coverage/retention split so there's one number that
// actually means "you'd likely remember this today."
export const LEARNED_THRESHOLD = 0.8;

export async function getLearningProgress(userId: string): Promise<DomainLearningProgress[]> {
  const db = getDb();
  const [certificationId, domains, weights, objectivesList] = await Promise.all([
    getActiveCertificationId(),
    getActiveDomains(),
    getActiveDomainWeights(),
    getActiveObjectives(),
  ]);
  const domainByObjective = new Map(objectivesList.map((o) => [o.number, o.domain]));

  const rows = await db
    .select()
    .from(cards)
    .where(and(eq(cards.userId, userId), eq(cards.certificationId, certificationId), eq(cards.status, 'active')));

  const labels = await objectiveLabels();

  type DomainBucket = { learned: number; total: number; topics: Map<string, { learned: number; total: number }> };
  const byDomain = new Map<string, DomainBucket>();
  for (const domain of domains) byDomain.set(domain, { learned: 0, total: 0, topics: new Map() });

  for (const row of rows) {
    const bucket = byDomain.get(row.domain);
    if (!bucket) continue; // a domain string outside the active cert's own list — skip rather than guess
    const r = computeRetrievability(row);
    const learned = r !== null && r >= LEARNED_THRESHOLD;
    bucket.total++;
    if (learned) bucket.learned++;

    if (!row.objective) continue;
    // Tally into the topic breakdown only when the objective's official
    // domain agrees with the card's own — keeps the expanded topic list
    // from double-counting a card under the wrong domain.
    if (domainByObjective.get(row.objective) !== row.domain) continue;
    if (!bucket.topics.has(row.objective)) bucket.topics.set(row.objective, { learned: 0, total: 0 });
    const t = bucket.topics.get(row.objective)!;
    t.total++;
    if (learned) t.learned++;
  }

  return domains.map((domain) => {
    const b = byDomain.get(domain)!;
    const topics: TopicLearningProgress[] = [...b.topics.entries()]
      .map(([objective, t]) => {
        const title = labels.get(objective);
        return {
          objective,
          domain,
          label: title ? `${objective} — ${title}` : objective,
          learnedCount: t.learned,
          totalCount: t.total,
        };
      })
      .sort((a, c) => a.objective.localeCompare(c.objective, undefined, { numeric: true }));
    return { domain, targetWeight: weights[domain], learnedCount: b.learned, totalCount: b.total, topics };
  });
}

export interface TopicProgress {
  objective: string;
  domain: string;
  label: string;
  cardCount: number;
  flaggedCount: number;
  retention: number | null;
  recallAccuracy: number | null;
  recallAttemptCount: number;
  isWeak: boolean;
}

export async function getTopicProgress(userId: string): Promise<TopicProgress[]> {
  const db = getDb();
  const [certificationId, objectivesList] = await Promise.all([getActiveCertificationId(), getActiveObjectives()]);
  const domainByObjective = new Map(objectivesList.map((o) => [o.number, o.domain]));

  const [cardRows, recallRows] = await Promise.all([
    db
      .select()
      .from(cards)
      .where(and(eq(cards.userId, userId), eq(cards.certificationId, certificationId), eq(cards.status, 'active'))),
    db
      .select({ objective: recallAttempts.objective, score: recallAttempts.score })
      .from(recallAttempts)
      .where(and(eq(recallAttempts.userId, userId), eq(recallAttempts.certificationId, certificationId))),
  ]);

  type Bucket = { domain: string; sum: number; reviewed: number; total: number; flagged: number };
  const byObjective = new Map<string, Bucket>();
  for (const row of cardRows) {
    if (!row.objective) continue;
    const domain = domainByObjective.get(row.objective);
    if (!domain) continue;
    if (!byObjective.has(row.objective)) byObjective.set(row.objective, { domain, sum: 0, reviewed: 0, total: 0, flagged: 0 });
    const b = byObjective.get(row.objective)!;
    b.total++;
    if (row.flagged) b.flagged++;
    const r = computeRetrievability(row);
    if (r !== null) {
      b.sum += r;
      b.reviewed++;
    }
  }

  const recallByObjective = new Map<string, { sum: number; count: number; attempts: number }>();
  for (const row of recallRows) {
    if (!row.objective) continue;
    if (!recallByObjective.has(row.objective)) recallByObjective.set(row.objective, { sum: 0, count: 0, attempts: 0 });
    const b = recallByObjective.get(row.objective)!;
    b.attempts++;
    if (row.score !== null) {
      b.sum += row.score;
      b.count++;
    }
  }

  // Objectives that only have recall attempts and no cards yet still deserve a row.
  const allObjectives = new Set([...byObjective.keys(), ...recallByObjective.keys()]);

  const labels = await objectiveLabels();

  const result: TopicProgress[] = [];
  for (const objective of allObjectives) {
    const domain = byObjective.get(objective)?.domain ?? domainByObjective.get(objective);
    if (!domain) continue;
    const cardBucket = byObjective.get(objective);
    const recallBucket = recallByObjective.get(objective);

    const retention = cardBucket && cardBucket.reviewed > 0 ? cardBucket.sum / cardBucket.reviewed : null;
    const recallAccuracy = recallBucket && recallBucket.count > 0 ? recallBucket.sum / recallBucket.count : null;

    result.push({
      objective,
      domain,
      label: labels.get(objective) ?? objective,
      cardCount: cardBucket?.total ?? 0,
      flaggedCount: cardBucket?.flagged ?? 0,
      retention,
      recallAccuracy,
      recallAttemptCount: recallBucket?.attempts ?? 0,
      isWeak: (retention !== null && retention < WEAK_THRESHOLD) || (recallAccuracy !== null && recallAccuracy < WEAK_THRESHOLD),
    });
  }

  result.sort((a, b) => a.objective.localeCompare(b.objective, undefined, { numeric: true }));
  return result;
}
