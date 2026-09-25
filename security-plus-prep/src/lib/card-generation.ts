// Shared single-card generation for the manual "Create card" feature
// (app/create/actions.ts). Reuses the exact same style rules, distractor
// standards, and Zod schema shape as the batch generation scripts
// (scripts/generate-gsc-cards.ts, rewrite-legacy-cards.ts, ingest-pdf.ts)
// instead of forking a new prompt — this is that shared copy, not a
// separate one.

import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { AI_MODELS } from './ai-models';

const client = new Anthropic();

export const GeneratedCardDraftSchema = z.object({
  type: z.enum(['multiple_choice', 'multiple_select']),
  topic: z.string(),
  authoredDifficulty: z.enum(['application', 'analysis']),
  question: z.string(),
  options: z.array(z.string()),
  correct: z.union([z.number(), z.array(z.number())]),
  requiredCount: z.number().optional(),
  explanation: z.string(),
  distractorExplanations: z.array(z.string()),
});
export type GeneratedCardDraft = z.infer<typeof GeneratedCardDraftSchema>;

const submitCardTool: Anthropic.Tool = {
  name: 'submit_card',
  description: 'Submit one generated CompTIA Security+ (SY0-701) practice question.',
  input_schema: {
    type: 'object',
    properties: {
      type: { type: 'string', enum: ['multiple_choice', 'multiple_select'] },
      topic: { type: 'string', description: 'Short 2-5 word topic label' },
      authoredDifficulty: { type: 'string', enum: ['application', 'analysis'] },
      question: { type: 'string' },
      options: { type: 'array', items: { type: 'string' } },
      correct: {
        description: 'Index into options for multiple_choice, array of indices for multiple_select',
        oneOf: [{ type: 'integer' }, { type: 'array', items: { type: 'integer' } }],
      },
      requiredCount: { type: 'integer', description: 'multiple_select only: how many options must be picked' },
      explanation: { type: 'string', description: 'Why the correct answer is BEST' },
      distractorExplanations: {
        type: 'array',
        items: { type: 'string' },
        description: 'MUST have exactly options.length entries, same order as options. "" at every correct index, a context-specific reason at every other index.',
      },
    },
    required: ['type', 'topic', 'authoredDifficulty', 'question', 'options', 'correct', 'explanation', 'distractorExplanations'],
  },
};

export interface DraftRequest {
  note: string;
  domain: string;
  objective?: string;
  type: 'multiple_choice' | 'multiple_select';
  requiredCount?: number; // multiple_select only
}

function buildPrompt(req: DraftRequest): string {
  const typeLine =
    req.type === 'multiple_select'
      ? `type: multiple_select, requiredCount: ${req.requiredCount ?? 2}`
      : `type: multiple_choice`;

  return `Write one original CompTIA Security+ (SY0-701) practice question from the note below. Test the concept in the note — do NOT copy its wording or format into the question; turn it into a fresh scenario.

domain: "${req.domain}"${req.objective ? `\nSY0-701 objective: ${req.objective}` : ''}
${typeLine}

Note (source material — context only):
"""${req.note}"""

STYLE — scenario-based, exam-realistic:
- 2-4 sentences of realistic organizational scenario (a company, a role, a constraint, an incident in progress), then a question ending in a natural CompTIA qualifier (BEST / MOST likely / FIRST / MOST cost-effective / GREATEST risk — pick whichever fits the concept).
- Candidate feedback on the real SY0-701 exam consistently says the hard part isn't obscure facts — it's that multiple options all look correct, and you must pick the BEST one by CompTIA's logic. Recreate that difficulty.

EVERY QUESTION has EXACTLY 4 options TOTAL. Never 5, never 6. options.length === 4 always. For multiple_select with requiredCount 2, that means exactly 2 correct + 2 incorrect = 4 total.

- All 4 options must be real, plausible, legitimate security controls or concepts — never a throwaway or nonsensical distractor. For multiple_choice: at least TWO of the four must be genuinely defensible; only ONE is BEST. For multiple_select: exactly requiredCount are correct, the rest plausible-but-inferior.

multiple_select DISTRACTOR QUALITY — this is exactly where generated "Choose two/three" questions tend to go weak: every wrong option must be a legitimate, real-world control a competent practitioner might genuinely reach for — plausible in general, wrong ONLY because of a specific detail in THIS scenario (wrong layer, wrong phase, wrong scope, wrong cost tier, solves a different risk). If a wrong option could be eliminated just by recognizing it's not a real or sensible control — without needing to read the scenario at all — rewrite it.

DISTRACTOR EXPLANATIONS — the highest-value part, do not skimp:
- EVERY wrong option, no exceptions, gets a real, specific, non-empty explanation written out in full, saying SPECIFICALLY why it is worse in THIS scenario — not merely "wrong."
- The top-level 'explanation' field must be genuine prose explaining why the correct answer(s) are BEST.

distractorExplanations ARRAY ALIGNMENT — this has been a source of bugs, follow it exactly:
- distractorExplanations must have EXACTLY the same length as options (4), one entry per option, in the SAME ORDER as options.
- The entry at each correct index (single index for multiple_choice, every index in correct[] for multiple_select) must be the empty string "".
- Every other index must have a non-empty, option-specific explanation.
- Before finalizing, verify: len(distractorExplanations) === len(options) === 4, and distractorExplanations[i] === "" if and only if i is a correct index.

${req.type === 'multiple_select' ? `The question text MUST end with "(Choose ${(req.requiredCount ?? 2) === 3 ? 'three' : 'two'}.)" matching requiredCount exactly. correct must be an array with exactly requiredCount indices.\n\n` : ''}topic: a short 2-5 word label for this question's subtopic.
authoredDifficulty: "application" or "analysis" only — never "recall". This is a judgment call, not a fact lookup.

Call submit_card with the completed question.`;
}

export async function generateCardDraft(req: DraftRequest): Promise<GeneratedCardDraft> {
  const response = await client.messages.create({
    model: AI_MODELS.content,
    max_tokens: 4096,
    tools: [submitCardTool],
    tool_choice: { type: 'tool', name: 'submit_card' },
    messages: [{ role: 'user', content: buildPrompt(req) }],
  });

  const toolUse = response.content.find((block): block is Anthropic.ToolUseBlock => block.type === 'tool_use');
  if (!toolUse) throw new Error('No tool_use block in response');

  const parsed = GeneratedCardDraftSchema.safeParse(toolUse.input);
  if (!parsed.success) {
    throw new Error(`Generation returned malformed data: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
  }
  return parsed.data;
}
