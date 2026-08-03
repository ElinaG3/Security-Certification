import type {
  MultipleChoiceContent,
  MultipleSelectContent,
  QuestionType,
} from '@/db/question-types';

// Client-safe views of question content — the correct answer, the overall
// explanation, and per-distractor explanations are never included. This is
// the only shape a Server Component may pass into a Client Component for an
// unanswered card: if a field isn't on these types, it physically cannot
// reach the browser before submitAnswer() runs.

export interface PublicMultipleChoiceContent {
  question: string;
  options: string[];
}

export interface PublicMultipleSelectContent {
  question: string;
  options: string[];
  requiredCount: number;
}

export type PublicQuestionContent = PublicMultipleChoiceContent | PublicMultipleSelectContent;

export interface PublicCard {
  id: string;
  domain: string;
  topic: string;
  type: 'multiple_choice' | 'multiple_select';
  content: PublicQuestionContent;
}

export function toPublicContent(
  type: QuestionType,
  content: MultipleChoiceContent | MultipleSelectContent
): PublicQuestionContent {
  if (type === 'multiple_select') {
    const c = content as MultipleSelectContent;
    return { question: c.question, options: c.options, requiredCount: c.requiredCount };
  }
  const c = content as MultipleChoiceContent;
  return { question: c.question, options: c.options };
}
