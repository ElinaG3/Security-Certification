import type {
  MultipleChoiceContent,
  MultipleSelectContent,
  QuestionType,
  ArtifactPbqContent,
  RemediationSelectContent,
  PbqArtifact,
  PbqSubQuestion,
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

// The artifact itself (log lines / table rows) is safe to send as-is — it
// doesn't reveal which rows/lines are correct on its own.

export type PublicPbqSubQuestion =
  | { answerMode: 'options'; question: string; options: string[]; requiredCount?: number }
  | { answerMode: 'artifact_rows'; question: string; requiredCount?: number }
  | { answerMode: 'cell_value'; question: string; column: string; rows: number[]; options: string[] };

export interface PublicArtifactPbqContent {
  scenario?: string;
  artifact: PbqArtifact;
  subQuestions: PublicPbqSubQuestion[];
}

export interface PublicRemediationSelectContent {
  scenario: string;
  question: string;
  actions: string[];
}

export type PublicQuestionContent =
  | PublicMultipleChoiceContent
  | PublicMultipleSelectContent
  | PublicArtifactPbqContent
  | PublicRemediationSelectContent;

export type PublicCardType =
  | 'multiple_choice'
  | 'multiple_select'
  | 'log_analysis'
  | 'config_table'
  | 'remediation_select';

export interface PublicCard {
  id: string;
  domain: string;
  topic: string;
  type: PublicCardType;
  content: PublicQuestionContent;
}

function toPublicSubQuestion(sq: PbqSubQuestion): PublicPbqSubQuestion {
  if (sq.answerMode === 'options') {
    return { answerMode: 'options', question: sq.question, options: sq.options, requiredCount: sq.requiredCount };
  }
  if (sq.answerMode === 'artifact_rows') {
    return { answerMode: 'artifact_rows', question: sq.question, requiredCount: sq.requiredCount };
  }
  return { answerMode: 'cell_value', question: sq.question, column: sq.column, rows: sq.rows, options: sq.options };
}

export function toPublicContent(
  type: QuestionType,
  content:
    | MultipleChoiceContent
    | MultipleSelectContent
    | ArtifactPbqContent
    | RemediationSelectContent
): PublicQuestionContent {
  if (type === 'multiple_select') {
    const c = content as MultipleSelectContent;
    return { question: c.question, options: c.options, requiredCount: c.requiredCount };
  }
  if (type === 'log_analysis' || type === 'config_table') {
    const c = content as ArtifactPbqContent;
    return {
      scenario: c.scenario,
      artifact: c.artifact,
      subQuestions: c.subQuestions.map(toPublicSubQuestion),
    };
  }
  if (type === 'remediation_select') {
    const c = content as RemediationSelectContent;
    return { scenario: c.scenario, question: c.question, actions: c.actions };
  }
  const c = content as MultipleChoiceContent;
  return { question: c.question, options: c.options };
}
