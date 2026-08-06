import type { PbqArtifact, PbqSubQuestion } from '@/db/question-types';

export interface OptionGrade {
  index: number;
  selected: boolean;
  correct: boolean;
  explanation: string;
}

export interface SubQuestionGrade {
  correct: boolean;
  correctAnswer: number[];
  options: OptionGrade[];
}

function toArray(v: number | number[]): number[] {
  return Array.isArray(v) ? v : [v];
}

// Shared by 'options' and 'artifact_rows' sub-questions — both are just
// "pick from an indexed pool" (the pool is sq.options, or the artifact's
// lines/rows), so grading is identical once the pool + correct indices are
// resolved.
export function gradeChoiceSet(
  selectedIdx: number[],
  correctIdx: number[],
  explanationByOption: string[]
): SubQuestionGrade {
  const correctSet = new Set(correctIdx);
  const selectedSet = new Set(selectedIdx);
  const correct =
    correctSet.size === selectedSet.size && [...correctSet].every((i) => selectedSet.has(i));
  const options = explanationByOption.map((explanation, index) => ({
    index,
    selected: selectedSet.has(index),
    correct: correctSet.has(index),
    explanation,
  }));
  return { correct, correctAnswer: [...correctSet].sort((a, b) => a - b), options };
}

// 'cell_value': one dropdown per row in `rows`, graded independently, but
// the sub-question as a whole is only "correct" if every row matches — no
// partial credit within a sub-question, only across sub-questions on a card.
export function gradeCellValues(
  rows: number[],
  selected: number[],
  correct: number[],
  explanationByOption: string[]
): SubQuestionGrade {
  const cellGrades: OptionGrade[] = rows.map((row, i) => {
    const selectedOption = selected[i];
    const correctOption = correct[i];
    return {
      index: row,
      selected: true,
      correct: selectedOption === correctOption,
      explanation: explanationByOption[selectedOption] ?? '',
    };
  });
  const allCorrect = cellGrades.every((c) => c.correct);
  return { correct: allCorrect, correctAnswer: correct, options: cellGrades };
}

export function gradeSubQuestion(
  sq: PbqSubQuestion,
  _artifact: PbqArtifact,
  selected: number[]
): SubQuestionGrade {
  if (sq.answerMode === 'cell_value') {
    return gradeCellValues(sq.rows, selected, sq.correct, sq.explanationByOption);
  }
  return gradeChoiceSet(selected, toArray(sq.correct), sq.explanationByOption);
}

export interface RemediationGrade {
  score: number;
  options: OptionGrade[];
}

// score = (correctlySelected - incorrectlySelected) / totalCorrect, clamped
// to [0,1]. Selecting nothing nets to 0; selecting everything nets to
// (totalCorrect - totalWrong) / totalCorrect, which is <= 1 but can go
// negative if there are more wrong options than right ones — either way,
// abstention and over-selection are never rewarded above what a genuinely
// well-chosen subset would score.
export function gradeRemediationSelect(
  selectedIdx: number[],
  correctIdx: number[],
  explanationByOption: string[]
): RemediationGrade {
  const correctSet = new Set(correctIdx);
  const selectedSet = new Set(selectedIdx);
  let correctlySelected = 0;
  let incorrectlySelected = 0;
  for (const i of selectedSet) {
    if (correctSet.has(i)) correctlySelected++;
    else incorrectlySelected++;
  }
  const totalCorrect = correctSet.size;
  const raw = totalCorrect === 0 ? 0 : (correctlySelected - incorrectlySelected) / totalCorrect;
  const score = Math.max(0, Math.min(1, raw));

  const options = explanationByOption.map((explanation, index) => ({
    index,
    selected: selectedSet.has(index),
    correct: correctSet.has(index),
    explanation,
  }));

  return { score, options };
}
