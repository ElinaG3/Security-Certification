import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { AI_MODELS } from './ai-models';
import { getActiveCertification } from './active-certification';

const client = new Anthropic();

// ---------------------------------------------------------------------
// Text grading — the core signal. Score = recalled-correctly / total key
// points in the source, computed from array lengths, never a letter grade.
// ---------------------------------------------------------------------

export interface GapReport {
  correct: string[];
  missed: string[];
  errors: string[];
}

export interface RecallGrade extends GapReport {
  score: number;
}

const gapReportTool: Anthropic.Tool = {
  name: 'submit_gap_report',
  description: 'Report which key points from the source material the learner recalled correctly, missed, or got factually wrong.',
  input_schema: {
    type: 'object',
    properties: {
      correct: {
        type: 'array',
        items: { type: 'string' },
        description: 'Key points from the source the learner stated correctly (their own phrasing is fine — judge meaning, not wording)',
      },
      missed: {
        type: 'array',
        items: { type: 'string' },
        description: 'Key points from the source the learner did not mention at all',
      },
      errors: {
        type: 'array',
        items: { type: 'string' },
        description: 'Specific things the learner stated that are factually wrong (not just missing) — describe the error, not just "wrong"',
      },
    },
    required: ['correct', 'missed', 'errors'],
  },
};

export async function gradeRecallText(recallText: string, sourceMaterial: string, topic: string): Promise<RecallGrade> {
  const cert = await getActiveCertification();
  const response = await client.messages.create({
    model: AI_MODELS.content,
    max_tokens: 2048,
    tools: [gapReportTool],
    tool_choice: { type: 'tool', name: 'submit_gap_report' },
    messages: [
      {
        role: 'user',
        content: `You are grading a free-recall (write-everything-you-know-from-memory) study attempt for the ${cert.name} (${cert.examCode}) topic "${topic}". This is feedback, not an exam — be specific and constructive, not a score in prose.

Source material (the ground truth — break it down into distinct key points/concepts):
"""${sourceMaterial || `(no source material available for this topic — grade only on general ${cert.examCode} accuracy for this topic name)`}"""

Learner's free-recall text:
"""${recallText}"""

Identify EVERY distinct key point in the source material, and classify the learner's coverage of each: correctly recalled (their own wording is fine, judge meaning), missed entirely (not mentioned), or stated but factually wrong (describe the specific error). Be thorough — a real key-point-by-key-point breakdown, not just 2-3 examples. Call submit_gap_report.`,
      },
    ],
  });

  const toolUse = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
  if (!toolUse) throw new Error('No tool_use block in grading response');
  // The model sometimes omits an array key entirely rather than sending []
  // when it's empty (e.g. no errors found) — schema marks it required, but
  // parsing must tolerate the omission rather than crash the grading call.
  const report = z
    .object({
      correct: z.array(z.string()).optional().default([]),
      missed: z.array(z.string()).optional().default([]),
      errors: z.array(z.string()).optional().default([]),
    })
    .parse(toolUse.input);

  const total = report.correct.length + report.missed.length;
  const score = total > 0 ? report.correct.length / total : 0;

  return { ...report, score };
}

// ---------------------------------------------------------------------
// Handwriting OCR — transcribe prose, separately describe diagrams.
// Transcription is shown to the user for confirmation before grading;
// OCR errors on technical terms must not count as knowledge gaps.
// ---------------------------------------------------------------------

export interface TranscriptionResult {
  transcription: string;
  diagramDescription: string | null;
}

const transcribeTool: Anthropic.Tool = {
  name: 'submit_transcription',
  description: 'Transcribe handwritten prose to text, and separately describe any diagrams/symbols present.',
  input_schema: {
    type: 'object',
    properties: {
      transcription: {
        type: 'string',
        description: 'Verbatim transcription of all handwritten PROSE text in the image. Do not include diagram labels here unless they are full sentences/notes.',
      },
      diagramDescription: {
        type: 'string',
        description: 'Description of any diagrams, sketches, arrows, or labeled symbols in the image — what is drawn and what it appears to label. Empty string if the image is pure text with no diagram.',
      },
    },
    required: ['transcription', 'diagramDescription'],
  },
};

export async function transcribeHandwriting(imageBase64: string, mediaType: string): Promise<TranscriptionResult> {
  const cert = await getActiveCertification();
  const response = await client.messages.create({
    model: AI_MODELS.content,
    max_tokens: 2048,
    tools: [transcribeTool],
    tool_choice: { type: 'tool', name: 'submit_transcription' },
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType as 'image/png' | 'image/jpeg', data: imageBase64 } },
          {
            type: 'text',
            text: `This is a photo or drawing of handwritten ${cert.name} study notes — free-recall prose, a diagram, or both. Transcribe every word of handwritten prose verbatim (best guess on unclear words — do not silently drop anything), and separately describe any diagram/sketch content. Technical terms and acronyms are common — transcribe your best literal reading even if uncertain; the user will review and correct it before grading. Call submit_transcription.`,
          },
        ],
      },
    ],
  });

  const toolUse = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
  if (!toolUse) throw new Error('No tool_use block in transcription response');
  const parsed = z
    .object({ transcription: z.string(), diagramDescription: z.string().optional().default('') })
    .parse(toolUse.input);

  return { transcription: parsed.transcription, diagramDescription: parsed.diagramDescription.trim() || null };
}

// ---------------------------------------------------------------------
// Drawing comments — qualitative only. NEVER a score, grade, or
// correct/incorrect verdict — the prompt explicitly forbids it, and the
// return type is a single string, structurally incapable of carrying a
// numeric score.
// ---------------------------------------------------------------------

const drawingCommentTool: Anthropic.Tool = {
  name: 'submit_drawing_comments',
  description: 'Give qualitative, non-scored feedback on a study diagram/sketch.',
  input_schema: {
    type: 'object',
    properties: {
      comments: {
        type: 'string',
        description: 'What the diagram shows, labels correctly, and what seems to be missing or unclear — qualitative observations only, phrased as feedback, never a score/grade/pass-fail verdict',
      },
    },
    required: ['comments'],
  },
};

export async function commentOnDrawing(imageBase64: string, mediaType: string, topic: string): Promise<string> {
  const cert = await getActiveCertification();
  const response = await client.messages.create({
    model: AI_MODELS.content,
    max_tokens: 1024,
    tools: [drawingCommentTool],
    tool_choice: { type: 'tool', name: 'submit_drawing_comments' },
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType as 'image/png' | 'image/jpeg', data: imageBase64 } },
          {
            type: 'text',
            text: `This is a study diagram/sketch for the ${cert.name} (${cert.examCode}) topic "${topic}". Give qualitative feedback only: what's labeled/shown correctly, what important elements seem to be missing or mislabeled. Do NOT give a score, grade, percentage, or pass/fail verdict of any kind — this is never scored, only commented on. Call submit_drawing_comments.`,
          },
        ],
      },
    ],
  });

  const toolUse = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
  if (!toolUse) throw new Error('No tool_use block in drawing-comment response');
  return z.object({ comments: z.string() }).parse(toolUse.input).comments;
}
