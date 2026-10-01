'use client';

import type { PublicRemediationSelectContent } from '@/lib/question-public';
import type { OptionGrade } from '@/lib/pbq-grading';

export interface RemediationResult {
  score: number;
  correct: boolean;
  options: OptionGrade[];
}

// Checklist of possible actions. Submitting is always allowed, including
// with nothing selected — gradeRemediationSelect scores an empty or full
// selection at 0 rather than the UI blocking the attempt.
export function RemediationSelectCard({
  content,
  selected,
  onChange,
  locked,
  result,
}: {
  content: PublicRemediationSelectContent;
  selected: number[];
  onChange: (values: number[]) => void;
  locked: boolean;
  result: RemediationResult | null;
}) {
  function toggle(i: number) {
    if (locked) return;
    onChange(selected.includes(i) ? selected.filter((x) => x !== i) : [...selected, i]);
  }

  return (
    <div>
      <p style={{ marginBottom: 12 }}>{content.scenario}</p>
      <p style={{ fontWeight: 600, marginBottom: 8 }}>{content.question}</p>

      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {content.actions.map((action, idx) => {
          const isSelected = selected.includes(idx);
          const grade = result?.options.find((o) => o.index === idx);
          let background = '#fff';
          if (grade) {
            if (grade.correct && grade.selected) background = '#d4f4dd'; // correctly taken
            else if (grade.correct && !grade.selected) background = '#fff3cd'; // missed
            else if (!grade.correct && grade.selected) background = '#f8d7da'; // shouldn't have picked
          } else if (isSelected) {
            background = '#e7f0ff';
          }
          return (
            <li key={idx} style={{ marginBottom: 8 }}>
              <button
                type="button"
                onClick={() => toggle(idx)}
                disabled={locked}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '10px 14px',
                  background,
                  border: '1px solid #ccc',
                  borderRadius: 6,
                  cursor: locked ? 'default' : 'pointer',
                }}
              >
                <span style={{ marginRight: 8 }}>{isSelected ? '☑' : '☐'}</span>
                {action}
                {grade && <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>{grade.explanation}</div>}
              </button>
            </li>
          );
        })}
      </ul>

      {result && (
        <p style={{ marginTop: 12, color: '#666' }}>Score: {(result.score * 100).toFixed(0)}%</p>
      )}
    </div>
  );
}
