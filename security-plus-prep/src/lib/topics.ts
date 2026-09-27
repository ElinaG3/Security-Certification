import { and, eq, isNotNull } from 'drizzle-orm';
import { getDb } from '@/db';
import { cards, ingestedChunks } from '@/db/schema';
import { domainForObjective } from './domains';
import type { MultipleChoiceContent, MultipleSelectContent } from '@/db/question-types';

export interface TopicSummary {
  objective: string;
  domain: string;
  label: string; // objective number + best-available title, e.g. "1.2 — Zero Trust / Non-repudiation"
  cardCount: number;
}

export interface TopicCard {
  id: string;
  topic: string;
  type: string;
  status: string;
  flagged: boolean;
  question: string;
}

export interface TopicDetail extends TopicSummary {
  cards: TopicCard[];
}

function questionText(row: typeof cards.$inferSelect): string {
  if (row.type === 'multiple_choice' || row.type === 'multiple_select') {
    return (row.content as MultipleChoiceContent | MultipleSelectContent).question;
  }
  return '';
}

// Best-available heading label per objective — real CompTIA wording isn't
// available yet (no official SY0-701 objectives PDF ingested), so this
// falls back to whatever section titles ingestedChunks happened to collect
// for that objective (from Messer's notes). Some objectives will have none
// (no source chunks yet) and show just the bare number.
async function objectiveLabels(): Promise<Map<string, string>> {
  const db = getDb();
  const chunks = await db
    .select({ objective: ingestedChunks.objective, sectionTitle: ingestedChunks.sectionTitle })
    .from(ingestedChunks)
    .where(isNotNull(ingestedChunks.objective));

  const byObjective = new Map<string, Set<string>>();
  for (const c of chunks) {
    if (!c.objective || !c.sectionTitle) continue;
    if (!byObjective.has(c.objective)) byObjective.set(c.objective, new Set());
    // Collapse "X" / "X (continued)" down to one entry.
    byObjective.get(c.objective)!.add(c.sectionTitle.replace(/\s*\(continued\)$/, ''));
  }

  const labels = new Map<string, string>();
  for (const [objective, titles] of byObjective) {
    labels.set(objective, [...titles].slice(0, 3).join(' / '));
  }
  return labels;
}

export async function listTopics(userId: string): Promise<{ topics: TopicSummary[]; orphanCount: number }> {
  const db = getDb();
  const rows = await db
    .select({ objective: cards.objective })
    .from(cards)
    .where(and(eq(cards.userId, userId), eq(cards.status, 'active')));

  const counts = new Map<string, number>();
  let orphanCount = 0;
  for (const r of rows) {
    if (!r.objective) {
      orphanCount++;
      continue;
    }
    counts.set(r.objective, (counts.get(r.objective) ?? 0) + 1);
  }

  const labels = await objectiveLabels();
  const topics: TopicSummary[] = [];
  for (const [objective, cardCount] of counts) {
    const domain = domainForObjective(objective);
    if (!domain) continue; // unrecognized prefix — shouldn't happen, skip rather than guess
    const title = labels.get(objective);
    topics.push({ objective, domain, cardCount, label: title ? `${objective} — ${title}` : objective });
  }

  topics.sort((a, b) => a.objective.localeCompare(b.objective, undefined, { numeric: true }));
  return { topics, orphanCount };
}

export async function getTopic(userId: string, objective: string): Promise<TopicDetail | null> {
  const domain = domainForObjective(objective);
  if (!domain) return null;

  const db = getDb();
  const rows = await db
    .select()
    .from(cards)
    .where(and(eq(cards.userId, userId), eq(cards.objective, objective)));
  if (rows.length === 0) return null;

  const labels = await objectiveLabels();
  const title = labels.get(objective);

  return {
    objective,
    domain,
    cardCount: rows.length,
    label: title ? `${objective} — ${title}` : objective,
    cards: rows
      .filter((r) => r.status === 'active' || r.status === 'pending')
      .map((r) => ({ id: r.id, topic: r.topic, type: r.type, status: r.status, flagged: r.flagged, question: questionText(r) })),
  };
}
