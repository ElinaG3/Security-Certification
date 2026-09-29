import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { AI_MODELS } from './ai-models';
import { getActiveCertification } from './active-certification';

const client = new Anthropic();

const translateTool: Anthropic.Tool = {
  name: 'submit_translation',
  description: 'Translate an English IT/cybersecurity term to German and give a one-sentence exam-context note.',
  input_schema: {
    type: 'object',
    properties: {
      translationDe: {
        type: 'string',
        description: 'The standard German IT-security term for this (not a literal word-for-word translation if a different term is the one actually used)',
      },
      contextNote: {
        type: 'string',
        description: 'One short sentence: what this term means in an IT security / exam context',
      },
    },
    required: ['translationDe', 'contextNote'],
  },
};

export interface TermTranslation {
  translationDe: string;
  contextNote: string;
}

// Runtime call (Haiku, not Sonnet) — this fires once per genuinely new
// term looked up, not a batch content-generation job.
export async function translateTerm(term: string): Promise<TermTranslation> {
  const cert = await getActiveCertification();
  const response = await client.messages.create({
    model: AI_MODELS.fast,
    max_tokens: 256,
    tools: [translateTool],
    tool_choice: { type: 'tool', name: 'submit_translation' },
    messages: [
      {
        role: 'user',
        content: `Translate the English term "${term}" to German, for a ${cert.name} (${cert.examCode}) exam learner. Give the standard German IT-security term (not a literal translation if a different term is actually used in the field) and one short sentence on what the term means in this exam's IT security context. Call submit_translation.`,
      },
    ],
  });

  const toolUse = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
  if (!toolUse) throw new Error('No tool_use block in translation response');
  return z.object({ translationDe: z.string().min(1), contextNote: z.string().min(1) }).parse(toolUse.input);
}
