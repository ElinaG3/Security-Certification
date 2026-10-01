import { createHash } from 'node:crypto';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { AI_MODELS } from './ai-models';
import type { ReadingSection } from './topics';

const client = new Anthropic();

export type CalloutKind = 'examtip' | 'watchout' | 'example' | 'remember';

export type StudySheetBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'bullets'; items: string[] }
  | { type: 'term'; term: string; definition: string }
  | { type: 'callout'; kind: CalloutKind; text: string }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'steps'; items: string[] };

export interface StudySheetSection {
  heading: string;
  emoji: string;
  blocks: StudySheetBlock[];
}

export interface StudySheetContent {
  sections: StudySheetSection[];
}

// Same source text the existing "Original text" Read view already shows —
// generation never sees anything the learner couldn't already read there.
export function sourceTextFromReading(reading: ReadingSection[]): string {
  return reading.map((r) => (r.sectionTitle ? `${r.sectionTitle}\n${r.content}` : r.content)).join('\n\n');
}

export function computeSourceHash(sourceText: string): string {
  return createHash('sha256').update(sourceText).digest('hex');
}

const BlockSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('paragraph'), text: z.string().min(1) }),
  z.object({ type: z.literal('bullets'), items: z.array(z.string().min(1)).min(1) }),
  z.object({ type: z.literal('term'), term: z.string().min(1), definition: z.string().min(1) }),
  z.object({ type: z.literal('callout'), kind: z.enum(['examtip', 'watchout', 'example', 'remember']), text: z.string().min(1) }),
  z.object({ type: z.literal('table'), headers: z.array(z.string().min(1)).min(1), rows: z.array(z.array(z.string())) }),
  z.object({ type: z.literal('steps'), items: z.array(z.string().min(1)).min(1) }),
]);
const SectionSchema = z.object({ heading: z.string().min(1), emoji: z.string().min(1).max(8), blocks: z.array(BlockSchema).min(1) });
const StudySheetSchema = z.object({ sections: z.array(SectionSchema).min(1) });

const studySheetTool: Anthropic.Tool = {
  name: 'submit_study_sheet',
  description: 'Submit a structured, easy-to-read study sheet rewriting the given source text into sections and typed content blocks.',
  input_schema: {
    type: 'object',
    properties: {
      sections: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            heading: { type: 'string' },
            emoji: { type: 'string', description: 'Exactly ONE emoji for this heading, nothing else' },
            blocks: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  type: { type: 'string', enum: ['paragraph', 'bullets', 'term', 'callout', 'table', 'steps'] },
                  text: { type: 'string', description: 'For paragraph and callout blocks' },
                  items: { type: 'array', items: { type: 'string' }, description: 'For bullets and steps blocks' },
                  term: { type: 'string', description: 'For term blocks — the term itself' },
                  definition: { type: 'string', description: 'For term blocks — a plain-language definition' },
                  kind: { type: 'string', enum: ['examtip', 'watchout', 'example', 'remember'], description: 'For callout blocks only' },
                  headers: { type: 'array', items: { type: 'string' }, description: 'For table blocks' },
                  rows: { type: 'array', items: { type: 'array', items: { type: 'string' } }, description: 'For table blocks — one array per row, same length as headers' },
                },
                required: ['type'],
              },
            },
          },
          required: ['heading', 'emoji', 'blocks'],
        },
      },
    },
    required: ['sections'],
  },
};

function buildPrompt(sourceText: string, topicLabel: string): string {
  return `Rewrite the following CompTIA Security+ (SY0-701) study material for topic "${topicLabel}" into a clear, visual study sheet.

HARD RULES — follow exactly, no exceptions:
- Use ONLY facts present in the source text below. Do not add, correct, or invent any fact, even one you believe is true or that the source seems to be missing.
- Keep every technical detail from the source: port numbers, acronyms, protocol/algorithm names, exact figures — never drop or paraphrase these away.
- Shorten wording and split long sentences; group related ideas into logical sections rather than following the source's paragraph breaks literally.
- At most ONE emoji per section heading, never inside body text, never more than one per section — no emoji spam.
- Keep everything in English.
- Use "term" blocks for key vocabulary (the term plus a plain-language definition drawn only from the source). Use "callout" blocks sparingly, only for a genuinely important exam tip, a common mistake/watch-out, a worked example, or a must-remember fact that's actually stated or clearly implied in the source. Use "table" blocks only when the source itself is naturally tabular (e.g. comparing several options side by side). Use "steps" blocks only for an actual ordered process. Use "bullets" for short parallel items, and "paragraph" for connected prose that doesn't fit any of the above.

SOURCE TEXT:
"""
${sourceText}
"""

Call submit_study_sheet with the complete study sheet.`;
}

// Exactly ONE Sonnet call, no internal retry — a failure here is surfaced
// to the caller as an error; the UI's own "Retry" button is what re-invokes
// this, not an automatic loop (see src/lib/topic-study-sheet.ts).
export async function generateStudySheet(sourceText: string, topicLabel: string): Promise<StudySheetContent> {
  const response = await client.messages.create({
    model: AI_MODELS.content,
    max_tokens: 4096,
    tools: [studySheetTool],
    tool_choice: { type: 'tool', name: 'submit_study_sheet' },
    messages: [{ role: 'user', content: buildPrompt(sourceText, topicLabel) }],
  });

  const toolUse = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
  if (!toolUse) throw new Error('No tool_use block in study sheet response');
  return StudySheetSchema.parse(toolUse.input);
}
