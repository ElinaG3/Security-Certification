'use server';

import { and, desc, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { recallAttempts } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth';
import { uploadRecallImage } from '@/lib/blob';
import { getSourceMaterialForObjective } from '@/lib/recall-source';
import { gradeRecallText, transcribeHandwriting, commentOnDrawing, type GapReport } from '@/lib/recall-grading';

async function fileToBase64(file: File): Promise<{ data: string; mediaType: string }> {
  const buf = Buffer.from(await file.arrayBuffer());
  return { data: buf.toString('base64'), mediaType: file.type || 'image/png' };
}

export interface RecallResult {
  attemptId: string;
  gapReport: GapReport;
  score: number;
  drawingComments: string | null;
}

// Text typed directly — the reliable core path, no image/vision step at
// all. `drawingFile` is optional: the "canvas alongside the text box" from
// the original design — commented on, never scored, stored on the same row.
export async function submitTypedRecall({
  objective,
  topic,
  text,
  drawingFile,
}: {
  objective: string | null;
  topic: string;
  text: string;
  drawingFile?: File;
}): Promise<RecallResult> {
  const user = await getCurrentUser();
  const db = getDb();

  const sourceMaterial = await getSourceMaterialForObjective(objective, user.id);
  const { score, ...gapReport } = await gradeRecallText(text, sourceMaterial, topic);

  let drawingUrl: string | null = null;
  let drawingComments: string | null = null;
  if (drawingFile) {
    drawingUrl = await uploadRecallImage(user.id, drawingFile, 'drawing');
    const { data, mediaType } = await fileToBase64(drawingFile);
    drawingComments = await commentOnDrawing(data, mediaType, topic);
  }

  const [row] = await db
    .insert(recallAttempts)
    .values({
      userId: user.id,
      objective,
      topic,
      inputMode: 'typed',
      rawText: text,
      gapReport,
      score,
      drawingUrl,
      drawingComments,
    })
    .returning();

  return { attemptId: row.id, gapReport, score, drawingComments };
}

// Step 1 of the handwritten path: upload + OCR only. Nothing is persisted
// as a completed attempt yet — grading is gated behind the user confirming
// the transcription (OCR errors on technical terms must not count as
// knowledge gaps).
export async function transcribeImage(file: File): Promise<{ imageUrl: string; transcription: string; diagramDescription: string | null }> {
  const user = await getCurrentUser();
  const [imageUrl, { data, mediaType }] = await Promise.all([
    uploadRecallImage(user.id, file, 'upload'),
    fileToBase64(file),
  ]);
  const { transcription, diagramDescription } = await transcribeHandwriting(data, mediaType);
  return { imageUrl, transcription, diagramDescription };
}

// Step 2: only reachable after the user has seen and (optionally edited)
// the transcription from transcribeImage and explicitly confirmed it.
// Grades confirmedTranscription exactly like typed text — same grading
// function, no separate code path. The same image doubles as the "drawing"
// for this row when it contains a diagram, so it shows up consistently in
// the topic hub's drawing list.
export async function submitHandwrittenRecall({
  objective,
  topic,
  imageUrl,
  rawTranscription,
  confirmedTranscription,
  diagramDescription,
}: {
  objective: string | null;
  topic: string;
  imageUrl: string;
  rawTranscription: string;
  confirmedTranscription: string;
  diagramDescription: string | null;
}): Promise<RecallResult> {
  const user = await getCurrentUser();
  const db = getDb();

  const sourceMaterial = await getSourceMaterialForObjective(objective, user.id);
  const { score, ...gapReport } = await gradeRecallText(confirmedTranscription, sourceMaterial, topic);

  const [row] = await db
    .insert(recallAttempts)
    .values({
      userId: user.id,
      objective,
      topic,
      inputMode: 'handwritten',
      imageUrl,
      transcription: rawTranscription,
      confirmedTranscription,
      gapReport,
      score,
      drawingUrl: diagramDescription ? imageUrl : null,
      drawingComments: diagramDescription,
    })
    .returning();

  return { attemptId: row.id, gapReport, score, drawingComments: diagramDescription };
}

// A pure diagram, no text recall attempted — comments only, no grading at
// all (score/gapReport stay null).
export async function submitDrawingOnly({
  objective,
  topic,
  drawingFile,
}: {
  objective: string | null;
  topic: string;
  drawingFile: File;
}): Promise<{ attemptId: string; drawingComments: string }> {
  const user = await getCurrentUser();
  const db = getDb();

  const [drawingUrl, { data, mediaType }] = await Promise.all([
    uploadRecallImage(user.id, drawingFile, 'drawing'),
    fileToBase64(drawingFile),
  ]);
  const drawingComments = await commentOnDrawing(data, mediaType, topic);

  const [row] = await db
    .insert(recallAttempts)
    .values({ userId: user.id, objective, topic, inputMode: 'drawing_only', drawingUrl, drawingComments })
    .returning();

  return { attemptId: row.id, drawingComments };
}

export interface RecallAttemptSummary {
  id: string;
  topic: string;
  inputMode: string;
  score: number | null;
  createdAt: Date;
  drawingUrl: string | null;
  drawingComments: string | null;
  gapReport: GapReport | null;
}

export async function listRecallAttempts(objective: string): Promise<RecallAttemptSummary[]> {
  const user = await getCurrentUser();
  const db = getDb();
  const rows = await db
    .select()
    .from(recallAttempts)
    .where(and(eq(recallAttempts.userId, user.id), eq(recallAttempts.objective, objective)))
    .orderBy(desc(recallAttempts.createdAt));

  return rows.map((r) => ({
    id: r.id,
    topic: r.topic,
    inputMode: r.inputMode,
    score: r.score,
    createdAt: r.createdAt,
    drawingUrl: r.drawingUrl,
    drawingComments: r.drawingComments,
    gapReport: r.gapReport as GapReport | null,
  }));
}
