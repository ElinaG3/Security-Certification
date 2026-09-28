'use server';

import { eq, and, desc } from 'drizzle-orm';
import { getDb } from '@/db';
import { pdfLibrary, ingestedChunks } from '@/db/schema';
import { getActiveCertificationId } from '@/lib/active-certification';
import { uploadCertificationPdf } from '@/lib/blob';
import { extractPdfPages, chunkPdfPages, persistChunks, scoreChunkNovelty } from '@/lib/pdf-ingestion';

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

export type UploadPdfResult = { ok: true; id: string; chunkCount: number } | { ok: false; issue: string };

// Upload only chunks + embeds (per the spec) — it does NOT generate cards.
// Card generation from a chunk stays a separate, explicit step (the
// existing /review-gated pipeline), same as the CLI ingestion path.
export async function uploadPdf(file: File): Promise<UploadPdfResult> {
  if (file.type !== 'application/pdf') return { ok: false, issue: 'Only PDF files are accepted.' };

  const certificationId = await getActiveCertificationId();
  const db = getDb();

  const buffer = Buffer.from(await file.arrayBuffer());
  const { pages, pageCount } = await extractPdfPages(buffer);
  if (pageCount === 0) return { ok: false, issue: 'Could not read any pages from this PDF.' };

  const blobUrl = await uploadCertificationPdf(certificationId, file);

  const [pdfRow] = await db
    .insert(pdfLibrary)
    .values({ certificationId, filename: file.name, blobUrl, pageCount })
    .returning();

  const rawChunks = chunkPdfPages(pages);
  const chunkRows = await persistChunks({ certificationId, pdfId: pdfRow.id, sourceFile: file.name, rawChunks });
  await scoreChunkNovelty(certificationId, chunkRows);

  return { ok: true, id: pdfRow.id, chunkCount: chunkRows.length };
}
