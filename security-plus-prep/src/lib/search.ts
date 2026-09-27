import { isNotNull } from 'drizzle-orm';
import { getDb } from '@/db';
import { ingestedChunks } from '@/db/schema';
import { embedText, cosineSimilarity } from './embeddings';

export interface ChunkSearchResult {
  id: string;
  sourceFile: string;
  objective: string | null;
  sectionTitle: string | null;
  subTopic: string | null;
  content: string;
  similarity: number;
}

const DEFAULT_LIMIT = 10;

// Same "embed once, compare in JS with the existing cosineSimilarity
// helper" approach ingest-pdf.ts already uses for novelty scoring —
// consistent with the rest of the codebase, and plenty fast at this corpus
// size (~163 chunks) without introducing a separate pgvector query path.
export async function searchChunks(query: string, limit = DEFAULT_LIMIT): Promise<ChunkSearchResult[]> {
  const trimmed = query.trim();
  if (trimmed === '') return [];

  const db = getDb();
  const [queryEmbedding, chunks] = await Promise.all([
    embedText(trimmed),
    db.select().from(ingestedChunks).where(isNotNull(ingestedChunks.embedding)),
  ]);

  return chunks
    .map((c) => ({
      id: c.id,
      sourceFile: c.sourceFile,
      objective: c.objective,
      sectionTitle: c.sectionTitle,
      subTopic: c.subTopic,
      content: c.content,
      similarity: cosineSimilarity(queryEmbedding, c.embedding as number[]),
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}
