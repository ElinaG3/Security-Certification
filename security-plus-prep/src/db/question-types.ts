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

// PBQ (performance-based question) types. log_analysis and config_table
// share one content shape (ArtifactPbqContent) — a static artifact (log
// excerpt or config table) with 2-4 independently-graded sub-questions
// layered on top, mirroring how CompTIA layers several questions on one
// PBQ artifact. remediation_select has no artifact, so it stays separate.

export interface PbqLogArtifact {
  kind: 'log_lines';
  lines: string[];
}

export interface PbqTableArtifact {
  kind: 'table';
  columns: string[];
  rows: string[][]; // each row's length matches columns.length
}

export type PbqArtifact = PbqLogArtifact | PbqTableArtifact;

// Every option/row/candidate on every PBQ sub-question gets a required,
// non-empty explanation — including correct ones. Unlike the legacy
// distractorExplanations convention (blank at the correct index), the
// correct entry's own explanation IS the "why this is right" content, so
// there's no separate top-level `explanation` field on these types.

export interface PbqOptionsSubQuestion {
  answerMode: 'options';
  question: string;
  options: string[];
  correct: number | number[];
  requiredCount?: number; // required when correct is an array with length > 1
  explanationByOption: string[]; // parallel to options, every entry non-empty
}

export interface PbqArtifactRowsSubQuestion {
  answerMode: 'artifact_rows';
  question: string;
  correct: number | number[]; // indices into the card's artifact.lines / artifact.rows
  requiredCount?: number;
  explanationByOption: string[]; // parallel to artifact.lines / artifact.rows
}

export interface PbqCellValueSubQuestion {
  answerMode: 'cell_value';
  question: string;
  column: string; // must match a column name in the table artifact
  rows: number[]; // row indices with a blanked cell in that column
  options: string[]; // shared candidate values (dropdown)
  correct: number[]; // parallel to `rows` — correct option index per row
  explanationByOption: string[]; // parallel to `options`
}

export type PbqSubQuestion =
  | PbqOptionsSubQuestion
  | PbqArtifactRowsSubQuestion
  | PbqCellValueSubQuestion;

export interface ArtifactPbqContent {
  scenario?: string;
  artifact: PbqArtifact;
  subQuestions: PbqSubQuestion[]; // typically 2-4
}

export interface RemediationSelectContent {
  scenario: string;
  question: string;
  actions: string[];
  correctActions: number[]; // indices into actions that are correct/needed
  explanationByOption: string[]; // parallel to actions, every entry non-empty
}

export type QuestionType =
  | 'multiple_choice'
  | 'multiple_select'
  | 'matching'
  | 'ordering'
  | 'drag_to_categorize'
  | 'fill_in'
  | 'scenario'
  | 'log_analysis'
  | 'config_table'
  | 'remediation_select';

export type QuestionContent =
  | MultipleChoiceContent
  | MultipleSelectContent
  | MatchingContent
  | OrderingContent
  | DragToCategorizeContent
  | FillInContent
  | ScenarioContent
  | ArtifactPbqContent
  | RemediationSelectContent;
