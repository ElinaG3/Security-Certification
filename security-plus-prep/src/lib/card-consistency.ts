// Structural consistency check for multiple_choice/multiple_select card
// content. Deterministic only — array lengths, index ranges, non-empty
// fields, "(Choose N)" count matching. It CANNOT catch semantic
// misalignment (an explanation whose text doesn't actually match its
// option) — that needs a human read.
//
// Shared by scripts/check-card-consistency.ts (which re-exports this) and
// the manual card-creation feature (app/create/actions.ts) — one
// implementation, not a fork per call site.

import type { MultipleChoiceContent, MultipleSelectContent } from '@/db/question-types';

type Content = MultipleChoiceContent | MultipleSelectContent;

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  '1': 1, '2': 2, '3': 3, '4': 4, '5': 5,
};

export function checkCardConsistency(content: Content, type: string): string[] {
  const issues: string[] = [];
  const correctIndices = Array.isArray(content.correct) ? content.correct : [content.correct];

  for (const idx of correctIndices) {
    if (idx < 0 || idx >= content.options.length) {
      issues.push(`correct index ${idx} out of range (${content.options.length} options)`);
    }
  }

  const seen = new Set<string>();
  content.options.forEach((opt) => {
    const key = opt.trim().toLowerCase();
    if (seen.has(key)) issues.push(`duplicate option: "${opt}"`);
    seen.add(key);
  });

  const de = content.distractorExplanations;
  if (!de) {
    issues.push('missing distractorExplanations array');
  } else {
    if (de.length !== content.options.length) {
      issues.push(`distractorExplanations length ${de.length} !== options length ${content.options.length}`);
    }
    content.options.forEach((_, idx) => {
      const isCorrect = correctIndices.includes(idx);
      const text = de[idx];
      if (isCorrect) {
        if (text && text.trim() !== '') {
          issues.push(`correct option ${idx} has a non-empty distractorExplanation (should be empty)`);
        }
      } else if (!text || text.trim() === '') {
        issues.push(`wrong option ${idx} has an empty/missing distractorExplanation`);
      }
    });
  }

  if (type === 'multiple_select') {
    const ms = content as MultipleSelectContent;
    const match = ms.question.match(/\(Choose (\w+)\.?\)/i);
    if (!match) {
      issues.push('multiple_select question missing "(Choose N.)" phrasing');
    } else {
      const n = NUMBER_WORDS[match[1].toLowerCase()];
      if (n === undefined) {
        issues.push(`could not parse "(Choose ${match[1]})" as a count`);
      } else {
        if (n !== correctIndices.length) {
          issues.push(`"(Choose ${match[1]})" says ${n} but correct[] has ${correctIndices.length} entries`);
        }
        if (ms.requiredCount !== n) {
          issues.push(`requiredCount (${ms.requiredCount}) doesn't match "(Choose ${match[1]})" (${n})`);
        }
      }
    }
  }

  return issues;
}
