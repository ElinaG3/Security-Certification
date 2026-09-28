// Shared PDF extraction/chunking/embedding logic — used by both the
// Library's upload action (app/library/actions.ts) and the CLI ingestion
// script (scripts/ingest-pdf.ts), which keeps its own card-GENERATION
// logic (hand-tuned prompt, batching, consistency-check retries) separate
// and calls into this module only for the extraction/chunking/embedding
// steps both paths need identically.
//
// Page-aware: pdf-parse exposes per-page text (TextResult.pages), which
// the original ingest-pdf.ts discarded by chunking the concatenated
// document string instead. Chunking here operates on {line, page} pairs so
// every chunk records the page range its text actually came from — what
// makes the Library's "open this PDF at the relevant page" possible.

import { and, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { ingestedChunks, cards } from '@/db/schema';
import { embedText, cosineSimilarity } from './embeddings';
import type { MultipleChoiceContent, MultipleSelectContent } from '@/db/question-types';

export interface RawChunk {
  objective: string | null; // null when no "N.N - Title" header was found (fallback by-page chunking)
  sectionTitle: string | null;
  content: string;
  startPage: number;
  endPage: number;
}

// pdf-parse re-exports pdfjs-dist's full "legacy" build (rendering
// included), whose canvas module runs `new DOMMatrix()` unconditionally at
// import time to size a scale matrix — real for rendering, dead code for
// us since we only call getText(). A native canvas package would normally
// supply DOMMatrix, but it isn't reliably present in Vercel's serverless
// bundle (works locally, 500s in prod: "ReferenceError: DOMMatrix is not
// defined"). A no-op stub is safe because the rendering path that
// constructs real matrices from it never executes on the getText() path.
// Importing pdf-parse dynamically (not statically) also keeps this whole
// dependency chain out of routes that never parse a PDF, like the
// /library list view.
function polyfillDomMatrix() {
  if (typeof globalThis.DOMMatrix !== 'undefined') return;
  class DOMMatrixStub {
    constructor(..._args: unknown[]) {}
  }
  (globalThis as unknown as { DOMMatrix: unknown }).DOMMatrix = DOMMatrixStub;
}

export async function extractPdfPages(buffer: Buffer): Promise<{ pages: { num: number; text: string }[]; pageCount: number }> {
  polyfillDomMatrix();
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: buffer });
  const extracted = await parser.getText();
  await parser.destroy();
  return { pages: extracted.pages.map((p) => ({ num: p.num, text: p.text })), pageCount: extracted.total };
}

const SECTION_HEADER_RE = /^(\d\.\d) - (.+)$/;

// One chunk per top-level section header ("1.3 - Change Management"),
// same heuristic ingest-pdf.ts already validated against Messer's notes
// (163 chunks at a median ~1500 chars) — now page-aware. Returns [] when
// the source doesn't use this heading convention at all, so callers can
// fall back to chunkByPage rather than silently ingesting nothing.
function chunkByHeaders(pages: { num: number; text: string }[]): RawChunk[] {
  const lines: { text: string; page: number }[] = [];
  for (const page of pages) {
    const cleaned = page.text.replace(/\n?-- \d+ of \d+ --\n?/g, '\n');
    for (const rawLine of cleaned.split('\n')) {
      lines.push({ text: rawLine, page: page.num });
    }
  }

  const chunks: RawChunk[] = [];
  let objective: string | null = null;
  let sectionTitle = '';
  let buffer: string[] = [];
  let startPage = 0;
  let endPage = 0;

  const flush = () => {
    const text = buffer.join('\n').trim();
    if (objective && text.length > 40) {
      chunks.push({ objective, sectionTitle, content: text, startPage, endPage });
    }
    buffer = [];
  };

  for (const { text: rawLine, page } of lines) {
    const line = rawLine.trim();
    // Real body headers ("1.3 - Change Management") never carry the
    // trailing "\t<page>" that table-of-contents entries do.
    const headerMatch = line.match(SECTION_HEADER_RE);
    if (headerMatch && !rawLine.includes('\t')) {
      flush();
      objective = headerMatch[1];
      sectionTitle = headerMatch[2];
      startPage = page;
      endPage = page;
      continue;
    }

    if (objective === null) continue; // still in front matter / table of contents
    if (line.length > 0) {
      buffer.push(line);
      endPage = page;
    }
  }
  flush();

  return chunks;
}

const PAGES_PER_FALLBACK_CHUNK = 2;

// Fallback for a PDF that doesn't use the "N.N - Title" heading
// convention at all (chunkByHeaders returns []) — most uploaded PDFs
// won't be Messer's notes. Chunks by a fixed page-window instead so the
// content is still ingested, searchable, and page-linkable; objective/
// sectionTitle stay null since there's no way to auto-detect them without
// the heading convention (a human can still tag a card generated from
// this chunk with an objective later, same as any manually-created card).
function chunkByPage(pages: { num: number; text: string }[]): RawChunk[] {
  const chunks: RawChunk[] = [];
  for (let i = 0; i < pages.length; i += PAGES_PER_FALLBACK_CHUNK) {
    const window = pages.slice(i, i + PAGES_PER_FALLBACK_CHUNK);
    const content = window
      .map((p) => p.text.trim())
      .filter(Boolean)
      .join('\n\n');
    if (content.length > 40) {
      chunks.push({ objective: null, sectionTitle: null, content, startPage: window[0].num, endPage: window[window.length - 1].num });
    }
  }
  return chunks;
}

export function chunkPdfPages(pages: { num: number; text: string }[]): RawChunk[] {
  const headerChunks = chunkByHeaders(pages);
  return headerChunks.length > 0 ? headerChunks : chunkByPage(pages);
}

// Embeds and persists chunks — dedups by (sourceFile, certificationId),
// same convention scripts/ingest-pdf.ts already used, so re-uploading the
// same filename never re-parses or re-embeds it.
export async function persistChunks({
  certificationId,
  pdfId,
  sourceFile,
  rawChunks,
}: {
  certificationId: string;
  // null for chunks with no Library entry to link to — e.g. the CLI script
  // reading a local file that was never uploaded to Blob, so there's
  // genuinely no in-app-viewable PDF for these chunks to point at.
  pdfId: string | null;
  sourceFile: string;
  rawChunks: RawChunk[];
}): Promise<(typeof ingestedChunks.$inferSelect)[]> {
  const db = getDb();
  const existing = await db
    .select()
    .from(ingestedChunks)
    .where(and(eq(ingestedChunks.sourceFile, sourceFile), eq(ingestedChunks.certificationId, certificationId)));
  if (existing.length > 0) return existing;

  const rows: (typeof ingestedChunks.$inferSelect)[] = [];
  for (const raw of rawChunks) {
    const embedding = await embedText(`${raw.sectionTitle ?? ''}. ${raw.content}`);
    const [inserted] = await db
      .insert(ingestedChunks)
      .values({
        certificationId,
        pdfId,
        sourceFile,
        objective: raw.objective,
        sectionTitle: raw.sectionTitle,
        content: raw.content,
        startPage: raw.startPage,
        endPage: raw.endPage,
        embedding,
      })
      .returning();
    rows.push(inserted);
  }
  return rows;
}

function cardEmbeddingText(content: MultipleChoiceContent | MultipleSelectContent): string {
  return [content.question, ...content.options, content.explanation].join(' ');
}

// Same novelty scoring ingest-pdf.ts already used — against every active
// card in the target certification.
export async function scoreChunkNovelty(certificationId: string, chunkRows: (typeof ingestedChunks.$inferSelect)[]): Promise<void> {
  const db = getDb();
  const toScore = chunkRows.filter((c) => !c.usedForGeneration);
  if (toScore.length === 0) return;

  const activeCards = await db
    .select()
    .from(cards)
    .where(and(eq(cards.status, 'active'), eq(cards.certificationId, certificationId)));
  const mcMs = activeCards.filter((c) => c.type === 'multiple_choice' || c.type === 'multiple_select');
  const cardEmbeddings: number[][] = [];
  for (const card of mcMs) {
    cardEmbeddings.push(await embedText(cardEmbeddingText(card.content as MultipleChoiceContent | MultipleSelectContent)));
  }

  for (const chunk of toScore) {
    if (!chunk.embedding) continue;
    let max = 0;
    for (const ce of cardEmbeddings) max = Math.max(max, cosineSimilarity(chunk.embedding as number[], ce));
    await db.update(ingestedChunks).set({ maxCardSimilarity: max }).where(eq(ingestedChunks.id, chunk.id));
    chunk.maxCardSimilarity = max;
  }
}
