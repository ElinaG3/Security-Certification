// Discriminated union for `cards.content`. `cards.type` is the discriminant.
// New variants can be added here without a migration — `content` is jsonb.

export interface MultipleChoiceContent {
  question: string;
  options: string[];
  correct: number; // index into options
  explanation: string; // why the correct answer is correct
  distractorExplanations?: string[]; // why each wrong option is wrong, same length/order as options
}

export interface MultipleSelectContent {
  question: string;
  options: string[];
  correct: number[]; // indices into options
  requiredCount: number;
  explanation: string;
  distractorExplanations?: string[];
}

export interface MatchingContent {
  question: string;
  columnA: string[];
  columnB: string[];
  correctPairs: [number, number][]; // [columnA index, columnB index]
  explanation: string;
}

export interface OrderingContent {
  question: string;
  steps: string[]; // shuffled for display
  correctOrder: number[]; // indices into steps, in correct sequence
  explanation: string;
}

export interface DragToCategorizeContent {
  question: string;
  items: string[];
  categories: string[];
  correctCategoryByItem: number[]; // category index per item, same order as items
  explanation: string;
}

export interface FillInContent {
  question: string;
  acceptedAnswers: string[]; // case-insensitive match
  explanation: string;
}

export interface ScenarioContent {
  scenario: string;
  inner: QuestionContent; // any non-scenario type, rendered after the scenario paragraph
}

export type QuestionType =
  | 'multiple_choice'
  | 'multiple_select'
  | 'matching'
  | 'ordering'
  | 'drag_to_categorize'
  | 'fill_in'
  | 'scenario';

export type QuestionContent =
  | MultipleChoiceContent
  | MultipleSelectContent
  | MatchingContent
  | OrderingContent
  | DragToCategorizeContent
  | FillInContent
  | ScenarioContent;
