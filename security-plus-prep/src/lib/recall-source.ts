import { and, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { cards, ingestedChunks } from '@/db/schema';
import { getActiveCertificationId } from './active-certification';
import type { MultipleChoiceContent, MultipleSelectContent } from '@/db/question-types';

// What "the topic's source material" means for recall grading: the raw
// ingested chunks for that objective (primary source, e.g. Messer's notes)
// plus the question/explanation text of every active card tagged to it
// (concept coverage the source chunks alone might not spell out as
// explicitly). Concatenated as plain text context for the grading prompt —
// no embeddings needed here, unlike search.ts, since this is "everything
// about objective X," not a similarity query.
export async function getSourceMaterialForObjective(objective: string | null, userId: string): Promise<string> {
  if (!objective) return '';
  const db = getDb();
  const certificationId = await getActiveCertificationId();

  const [chunks, cardRows] = await Promise.all([
    db
      .select({ content: ingestedChunks.content, sectionTitle: ingestedChunks.sectionTitle })
      .from(ingestedChunks)
      .where(and(eq(ingestedChunks.certificationId, certificationId), eq(ingestedChunks.objective, objective))),
    db
      .select()
      .from(cards)
      .where(and(eq(cards.userId, userId), eq(cards.certificationId, certificationId), eq(cards.objective, objective), eq(cards.status, 'active'))),
  ]);

  const parts: string[] = [];
  for (const c of chunks) {
    parts.push(`[Source notes${c.sectionTitle ? ` — ${c.sectionTitle}` : ''}]\n${c.content}`);
  }
  for (const row of cardRows) {
    if (row.type !== 'multiple_choice' && row.type !== 'multiple_select') continue;
    const content = row.content as MultipleChoiceContent | MultipleSelectContent;
    parts.push(`[Card concept — ${row.topic}]\nQ: ${content.question}\nWhy: ${content.explanation}`);
  }

  return parts.join('\n\n');
}
