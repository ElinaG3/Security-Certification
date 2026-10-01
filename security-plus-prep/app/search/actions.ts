'use server';

import { getCurrentUser } from '@/lib/auth';
import { searchChunks, type ChunkSearchResult } from '@/lib/search';

// Auth-gated even though ingested_chunks isn't per-user (single-user app,
// v1) — matches every other server action's pattern of requiring a current
// user before touching the DB.
export async function search(query: string): Promise<ChunkSearchResult[]> {
  await getCurrentUser();
  return searchChunks(query);
}
