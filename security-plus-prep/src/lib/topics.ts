import { and, eq, isNotNull } from 'drizzle-orm';
import { getDb } from '@/db';
import { cards, ingestedChunks, pdfLibrary } from '@/db/schema';
import { getActiveCertificationId, domainForObjectiveActive } from './active-certification';
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

export interface TopicPdfReference {
  pdfId: string;
  filename: string;
  sectionTitle: string | null;
  startPage: number;
  endPage: number;
}

export interface TopicDetail extends TopicSummary {
  cards: TopicCard[];
  pdfReferences: TopicPdfReference[];
}

function questionText(row: typeof cards.$inferSelect): string {
  if (row.type === 'multiple_choice' || row.type === 'multiple_select') {
    return (row.content as MultipleChoiceContent | MultipleSelectContent).question;
  }
  return '';
}

// Best-available heading label per objective — real official exam wording
// isn't available yet for every certification, so this falls back to
// whatever section titles ingestedChunks happened to collect for that
// objective from source material. Some objectives will have none (no
// source chunks yet) and show just the bare number. Scoped to the active
// certification, same as everything else here.
export async function objectiveLabels(): Promise<Map<string, string>> {
  const db = getDb();
  const certificationId = await getActiveCertificationId();
  const chunks = await db
    .select({ objective: ingestedChunks.objective, sectionTitle: ingestedChunks.sectionTitle })
    .from(ingestedChunks)
    .where(and(eq(ingestedChunks.certificationId, certificationId), isNotNull(ingestedChunks.objective)));

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
  const certificationId = await getActiveCertificationId();
  const rows = await db
    .select({ objective: cards.objective })
    .from(cards)
    .where(and(eq(cards.userId, userId), eq(cards.certificationId, certificationId), eq(cards.status, 'active')));

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
    const domain = await domainForObjectiveActive(objective);
    if (!domain) continue; // not a recognized objective for the active cert — skip rather than guess
    const title = labels.get(objective);
    topics.push({ objective, domain, cardCount, label: title ? `${objective} — ${title}` : objective });
  }

  topics.sort((a, b) => a.objective.localeCompare(b.objective, undefined, { numeric: true }));
  return { topics, orphanCount };
}

export async function getTopic(userId: string, objective: string): Promise<TopicDetail | null> {
  const domain = await domainForObjectiveActive(objective);
  if (!domain) return null; // not a recognized objective for the active cert — the only real 404 case

  const db = getDb();
  const certificationId = await getActiveCertificationId();
  const [cardRows, chunkRows] = await Promise.all([
    db
      .select()
      .from(cards)
      .where(and(eq(cards.userId, userId), eq(cards.certificationId, certificationId), eq(cards.objective, objective))),
    // Library-linked chunks only (pdfId set) — a chunk with no PDF entry
    // (e.g. from the CLI's local-file path) has nothing to deep-link to.
    db
      .select({
        pdfId: ingestedChunks.pdfId,
        filename: pdfLibrary.filename,
        sectionTitle: ingestedChunks.sectionTitle,
        startPage: ingestedChunks.startPage,
        endPage: ingestedChunks.endPage,
      })
      .from(ingestedChunks)
      .innerJoin(pdfLibrary, eq(ingestedChunks.pdfId, pdfLibrary.id))
      .where(and(eq(ingestedChunks.certificationId, certificationId), eq(ingestedChunks.objective, objective), isNotNull(ingestedChunks.pdfId))),
  ]);
  // A topic can be real (a recognized objective) with zero cards so far —
  // e.g. right after uploading a PDF, before any cards are generated from
  // it — so this no longer 404s just because cardRows is empty.

  const labels = await objectiveLabels();
  const title = labels.get(objective);

  return {
    objective,
    domain,
    cardCount: cardRows.length,
    label: title ? `${objective} — ${title}` : objective,
    cards: cardRows
      .filter((r) => r.status === 'active' || r.status === 'pending')
      .map((r) => ({ id: r.id, topic: r.topic, type: r.type, status: r.status, flagged: r.flagged, question: questionText(r) })),
    pdfReferences: chunkRows
      .filter((c): c is typeof c & { pdfId: string; startPage: number; endPage: number } => c.pdfId !== null && c.startPage !== null && c.endPage !== null)
      .map((c) => ({ pdfId: c.pdfId, filename: c.filename, sectionTitle: c.sectionTitle, startPage: c.startPage, endPage: c.endPage })),
  };
}
