'use server';

import { eq, and, desc } from 'drizzle-orm';
import { getDb } from '@/db';
import { pdfLibrary, ingestedChunks } from '@/db/schema';
import { getActiveCertificationId } from '@/lib/active-certification';
import { extractPdfPages, chunkPdfPages, persistChunks, scoreChunkNovelty } from '@/lib/pdf-ingestion';

// maxDuration for ingestUploadedPdf below lives on app/library/page.tsx,
// not here — a 'use server' file may only export async functions, so a
// route-segment-config constant can't live in this file at all.

export interface LibraryPdf {
  id: string;
  filename: string;
  blobUrl: string;
  pageCount: number;
  uploadedAt: Date;
  chunkCount: number;
}

export async function listPdfs(): Promise<LibraryPdf[]> {
  const certificationId = await getActiveCertificationId();
  const db = getDb();
  const [pdfs, chunks] = await Promise.all([
    db.select().from(pdfLibrary).where(eq(pdfLibrary.certificationId, certificationId)).orderBy(desc(pdfLibrary.uploadedAt)),
    db.select({ pdfId: ingestedChunks.pdfId }).from(ingestedChunks).where(eq(ingestedChunks.certificationId, certificationId)),
  ]);
  const countByPdf = new Map<string, number>();
  for (const c of chunks) {
    if (!c.pdfId) continue;
    countByPdf.set(c.pdfId, (countByPdf.get(c.pdfId) ?? 0) + 1);
  }
  return pdfs.map((p) => ({
    id: p.id,
    filename: p.filename,
    blobUrl: p.blobUrl,
    pageCount: p.pageCount,
    uploadedAt: p.uploadedAt,
    chunkCount: countByPdf.get(p.id) ?? 0,
  }));
}

export async function getPdf(id: string): Promise<LibraryPdf | null> {
  const certificationId = await getActiveCertificationId();
  const db = getDb();
  const [row] = await db.select().from(pdfLibrary).where(and(eq(pdfLibrary.id, id), eq(pdfLibrary.certificationId, certificationId)));
  if (!row) return null;
  const chunks = await db
    .select({ pdfId: ingestedChunks.pdfId })
    .from(ingestedChunks)
    .where(and(eq(ingestedChunks.pdfId, id), eq(ingestedChunks.certificationId, certificationId)));
  return { id: row.id, filename: row.filename, blobUrl: row.blobUrl, pageCount: row.pageCount, uploadedAt: row.uploadedAt, chunkCount: chunks.length };
}

export type IngestPdfResult =
  | { ok: true; id: string; pageCount: number; chunkCount: number }
  | { ok: false; issue: string };

// The file itself is already in Blob storage by the time this runs — the
// client uploads directly (src/components/library/UploadPdfForm.tsx via
// @vercel/blob/client's upload(), through the token endpoint at
// app/api/library/upload/route.ts) rather than passing the raw bytes
// through a Server Action body, which is how a ~10MB PDF used to hang
// forever (Next.js's default Server Action body limit is 1MB — the
// request never completed, and nothing surfaced an error). This action
// only ever receives a blob URL + filename, a tiny payload regardless of
// PDF size.
//
// Only chunks + embeds (per the spec) — it does NOT generate cards. Card
// generation from a chunk stays a separate, explicit step (the existing
// /review-gated pipeline), same as the CLI ingestion path.
export async function ingestUploadedPdf({ blobUrl, filename }: { blobUrl: string; filename: string }): Promise<IngestPdfResult> {
  const certificationId = await getActiveCertificationId();

  // The upload token was already scoped to this certification's own path
  // (see onBeforeGenerateToken in the route handler), but that's enforced
  // at upload time — re-check here too, since this action is a second,
  // independent entry point that must not trust a client-supplied URL on
  // its own for which certification's data it may write into.
  const expectedPrefix = `/library/${certificationId}/`;
  if (new URL(blobUrl).pathname.startsWith(expectedPrefix) === false) {
    return { ok: false, issue: 'This file was not uploaded for the active certification.' };
  }

  const db = getDb();

  let buffer: Buffer;
  try {
    const res = await fetch(blobUrl);
    if (!res.ok) return { ok: false, issue: `Could not read the uploaded file (HTTP ${res.status}).` };
    buffer = Buffer.from(await res.arrayBuffer());
  } catch {
    return { ok: false, issue: 'Could not read the uploaded file.' };
  }

  const { pages, pageCount } = await extractPdfPages(buffer);
  if (pageCount === 0) return { ok: false, issue: 'Could not read any pages from this PDF.' };

  const [pdfRow] = await db.insert(pdfLibrary).values({ certificationId, filename, blobUrl, pageCount }).returning();

  const rawChunks = chunkPdfPages(pages);
  const chunkRows = await persistChunks({ certificationId, pdfId: pdfRow.id, sourceFile: filename, rawChunks });
  await scoreChunkNovelty(certificationId, chunkRows);

  return { ok: true, id: pdfRow.id, pageCount, chunkCount: chunkRows.length };
}
