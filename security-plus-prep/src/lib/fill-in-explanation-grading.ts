import Anthropic from '@anthropic-ai/sdk';
import { AI_MODELS } from './ai-models';
import { getActiveCertification } from './active-certification';
import type { FillInContent } from '@/db/question-types';

const client = new Anthropic();

export type ExplanationVerdict = 'correct' | 'partial' | 'wrong';
export type ExplanationGrade = { verdict: ExplanationVerdict; reason: string };

const gradeTool: Anthropic.Tool = {
  name: 'grade_explanation',
  description: "Judge a candidate's free-text explanation against the key points it should cover.",
  input_schema: {
    type: 'object',
    properties: {
      verdict: {
        type: 'string',
        enum: ['correct', 'partial', 'wrong'],
        description:
          "'correct': covers the key point(s) accurately, even if worded differently. 'partial': gets the general idea but misses a key point or is vague/incomplete. 'wrong': misses the point entirely, or states something factually incorrect.",
      },
      reason: {
        type: 'string',
        description: 'One short sentence (max ~15 words) saying why — what it got right or what it missed.',
      },
    },
    required: ['verdict', 'reason'],
  },
};

// Grades a "explain in 1-2 sentences why/how..." style fill_in answer.
// Unlike gradeFillIn's string-match-first design (exact terms have no
// useful string-similarity shortcut for free text), every explanation
// answer goes straight to a single Haiku tool-call — still the cheap
// model, just no cheap deterministic path exists to try first here.
export async function gradeFillInExplanation(userAnswer: string, content: FillInContent): Promise<ExplanationGrade> {
  if (userAnswer.trim() === '') {
    return { verdict: 'wrong', reason: 'No answer given.' };
  }

  const cert = await getActiveCertification();
  const response = await client.messages.create({
    model: AI_MODELS.fast,
    max_tokens: 128,
    tools: [gradeTool],
    tool_choice: { type: 'tool', name: 'grade_explanation' },
    messages: [
      {
        role: 'user',
        content: `${cert.name} (${cert.examCode}) short-explanation grading.

Question: "${content.question}"
Key point(s) the answer should cover: ${content.acceptedAnswers.map((a) => `"${a}"`).join(', ')}
Reference explanation (for your own context, not something the candidate needed to match word-for-word): "${content.explanation}"

Candidate's answer: "${userAnswer}"

Judge whether the candidate's answer demonstrates understanding of the key point(s) above — allow for different phrasing, but not different or missing substance. Call grade_explanation.`,
      },
    ],
  });

  const toolUse = response.content.find((block): block is Anthropic.ToolUseBlock => block.type === 'tool_use');
  if (!toolUse) return { verdict: 'wrong', reason: 'Could not grade this answer — try again.' };

  const input = toolUse.input as { verdict?: string; reason?: string };
  const verdict: ExplanationVerdict = input.verdict === 'correct' || input.verdict === 'partial' ? input.verdict : 'wrong';
  return { verdict, reason: input.reason ?? '' };
}
