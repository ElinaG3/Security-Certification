'use client';

import type { PbqArtifact } from '@/db/question-types';
import type { PublicArtifactPbqContent, PublicPbqSubQuestion } from '@/lib/question-public';

export interface ArtifactPbqSubQuestionResult {
  correct: boolean;
  correctAnswer: number[];
  options: { index: number; selected: boolean; correct: boolean; explanation: string }[];
}

export interface ArtifactPbqResult {
  score: number;
  correct: boolean;
  subQuestions: ArtifactPbqSubQuestionResult[];
}

interface InteractiveProps {
  selected: number[];
  toggle: (i: number) => void;
  locked: boolean;
  resultOptions?: { index: number; selected: boolean; correct: boolean }[];
}

function rowBackground(i: number, interactive?: InteractiveProps): string {
  if (!interactive) return 'transparent';
  const grade = interactive.resultOptions?.find((o) => o.index === i);
  if (grade) {
    if (grade.correct) return '#d4f4dd';
    if (grade.selected) return '#f8d7da';
    return 'transparent';
  }
  return interactive.selected.includes(i) ? '#e7f0ff' : 'transparent';
}

function isMulti(sq: Extract<PublicPbqSubQuestion, { answerMode: 'options' | 'artifact_rows' }>): boolean {
  return sq.requiredCount !== undefined && sq.requiredCount > 1;
}

function toggleIndex(i: number, current: number[], multi: boolean, onChange: (v: number[]) => void) {
  if (multi) {
    onChange(current.includes(i) ? current.filter((x) => x !== i) : [...current, i]);
  } else {
    onChange([i]);
  }
}

export function artifactPool(artifact: PbqArtifact): string[] {
  return artifact.kind === 'log_lines' ? artifact.lines : artifact.rows.map((row) => row.join('  |  '));
}

function LogLinesBlock({ lines, interactive }: { lines: string[]; interactive?: InteractiveProps }) {
  return (
    <div
      style={{
        background: '#f5f5f5',
        border: '1px solid #ccc',
        borderRadius: 6,
        padding: 12,
        fontFamily: 'monospace',
        fontSize: 13,
        overflowX: 'auto',
        marginBottom: 16,
      }}
    >
      {lines.map((line, i) => (
        <div
          key={i}
          onClick={interactive && !interactive.locked ? () => interactive.toggle(i) : undefined}
          style={{
            cursor: interactive && !interactive.locked ? 'pointer' : 'default',
            background: rowBackground(i, interactive),
            padding: '2px 6px',
            borderRadius: 3,
            whiteSpace: 'pre-wrap',
          }}
        >
          <span style={{ color: '#999', marginRight: 10 }}>{String(i + 1).padStart(2, '0')}</span>
          {line}
        </div>
      ))}
    </div>
  );
}

function TableBlock({
  artifact,
  interactive,
}: {
  artifact: Extract<PbqArtifact, { kind: 'table' }>;
  interactive?: InteractiveProps;
}) {
  return (
    <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13, marginBottom: 16 }}>
      <thead>
        <tr>
          {artifact.columns.map((col, i) => (
            <th key={i} style={{ border: '1px solid #ccc', padding: '6px 8px', textAlign: 'left', background: '#f5f5f5' }}>
              {col}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {artifact.rows.map((row, i) => (
          <tr
            key={i}
            onClick={interactive && !interactive.locked ? () => interactive.toggle(i) : undefined}
            style={{ cursor: interactive && !interactive.locked ? 'pointer' : 'default', background: rowBackground(i, interactive) }}
          >
            {row.map((cell, j) => (
              <td key={j} style={{ border: '1px solid #ccc', padding: '6px 8px' }}>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function IndexedChoiceList({
  items,
  selected,
  onChange,
  locked,
  multi,
  resultOptions,
}: {
  items: string[];
  selected: number[];
  onChange: (values: number[]) => void;
  locked: boolean;
  multi: boolean;
  resultOptions?: { index: number; selected: boolean; correct: boolean; explanation: string }[];
}) {
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0' }}>
      {items.map((text, idx) => {
        const isSelected = selected.includes(idx);
        const grade = resultOptions?.find((o) => o.index === idx);
        let background = '#fff';
        if (grade) {
          if (grade.correct) background = '#d4f4dd';
          else if (grade.selected) background = '#f8d7da';
        } else if (isSelected) {
          background = '#e7f0ff';
        }
        return (
          <li key={idx} style={{ marginBottom: 6 }}>
            <button
              type="button"
              onClick={() => toggleIndex(idx, selected, multi, onChange)}
              disabled={locked}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '8px 12px',
                background,
                border: '1px solid #ccc',
                borderRadius: 6,
                cursor: locked ? 'default' : 'pointer',
              }}
            >
              {text}
              {grade && <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>{grade.explanation}</div>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function CellValueInput({
  sq,
  selected,
  onChange,
  locked,
  result,
}: {
  sq: Extract<PublicPbqSubQuestion, { answerMode: 'cell_value' }>;
  selected: number[];
  onChange: (values: number[]) => void;
  locked: boolean;
  result: ArtifactPbqSubQuestionResult | null;
}) {
  function setRow(rowPos: number, optionIdx: number) {
    if (locked) return;
    const next = [...selected];
    next[rowPos] = optionIdx;
    onChange(next);
  }

  return (
    <div>
      {sq.rows.map((row, rowPos) => {
        const grade = result?.options[rowPos];
        return (
          <div key={row} style={{ marginBottom: 10 }}>
            <span style={{ marginRight: 8 }}>
              {sq.column} — row {row + 1}:
            </span>
            <select value={selected[rowPos] ?? ''} onChange={(e) => setRow(rowPos, Number(e.target.value))} disabled={locked}>
              <option value="" disabled>
                Select…
              </option>
              {sq.options.map((opt, idx) => (
                <option key={idx} value={idx}>
                  {opt}
                </option>
              ))}
            </select>
            {grade && (
              <div style={{ fontSize: 13, color: grade.correct ? '#2e7d32' : '#c0392b', marginTop: 4 }}>
                {grade.explanation}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SubQuestionInput({
  artifact,
  sq,
  selected,
  onChange,
  locked,
  result,
}: {
  artifact: PbqArtifact;
  sq: PublicPbqSubQuestion;
  selected: number[];
  onChange: (v: number[]) => void;
  locked: boolean;
  result: ArtifactPbqSubQuestionResult | null;
}) {
  return (
    <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #eee' }}>
      <p style={{ fontWeight: 600, marginBottom: 4 }}>{sq.question}</p>
      {result && (
        <p style={{ fontWeight: 700, color: result.correct ? '#2e7d32' : '#c0392b', marginBottom: 6 }}>
          {result.correct ? 'Correct' : 'Incorrect'}
        </p>
      )}

      {sq.answerMode === 'options' && (
        <IndexedChoiceList
          items={sq.options}
          selected={selected}
          onChange={onChange}
          locked={locked}
          multi={isMulti(sq)}
          resultOptions={result?.options}
        />
      )}

      {sq.answerMode === 'artifact_rows' && (
        <IndexedChoiceList
          items={artifactPool(artifact)}
          selected={selected}
          onChange={onChange}
          locked={locked}
          multi={isMulti(sq)}
          resultOptions={result?.options}
        />
      )}

      {sq.answerMode === 'cell_value' && (
        <CellValueInput sq={sq} selected={selected} onChange={onChange} locked={locked} result={result} />
      )}
    </div>
  );
}

// log_analysis and config_table share this one rendering/grading path — the
// only difference is the artifact shape (log lines vs. a table). The first
// 'artifact_rows' sub-question (if any) is rendered by making the artifact
// itself clickable, per spec: "don't duplicate the lines as separate
// options below." Any later sub-question renders its own input beneath.
export function ArtifactPbqCard({
  content,
  selected,
  onChange,
  locked,
  result,
}: {
  content: PublicArtifactPbqContent;
  selected: number[][];
  onChange: (subIndex: number, values: number[]) => void;
  locked: boolean;
  result: ArtifactPbqResult | null;
}) {
  const primaryRowsIndex = content.subQuestions.findIndex((sq) => sq.answerMode === 'artifact_rows');
  const primarySq =
    primaryRowsIndex >= 0
      ? (content.subQuestions[primaryRowsIndex] as Extract<PublicPbqSubQuestion, { answerMode: 'artifact_rows' }>)
      : null;

  const primaryInteractive: InteractiveProps | undefined = primarySq
    ? {
        selected: selected[primaryRowsIndex] ?? [],
        toggle: (i) =>
          toggleIndex(i, selected[primaryRowsIndex] ?? [], isMulti(primarySq), (v) => onChange(primaryRowsIndex, v)),
        locked,
        resultOptions: result?.subQuestions[primaryRowsIndex]?.options,
      }
    : undefined;

  return (
    <div>
      {content.scenario && <p style={{ marginBottom: 12 }}>{content.scenario}</p>}

      {primarySq && (
        <>
          <p style={{ fontWeight: 600, marginBottom: 4 }}>{primarySq.question}</p>
          {result?.subQuestions[primaryRowsIndex] && (
            <p
              style={{
                fontWeight: 700,
                color: result.subQuestions[primaryRowsIndex].correct ? '#2e7d32' : '#c0392b',
                marginBottom: 6,
              }}
            >
              {result.subQuestions[primaryRowsIndex].correct ? 'Correct' : 'Incorrect'}
            </p>
          )}
        </>
      )}

      {content.artifact.kind === 'log_lines' ? (
        <LogLinesBlock lines={content.artifact.lines} interactive={primaryInteractive} />
      ) : (
        <TableBlock artifact={content.artifact} interactive={primaryInteractive} />
      )}

      {content.subQuestions.map((sq, i) => {
        if (i === primaryRowsIndex) return null;
        return (
          <SubQuestionInput
            key={i}
            artifact={content.artifact}
            sq={sq}
            selected={selected[i] ?? []}
            onChange={(v) => onChange(i, v)}
            locked={locked}
            result={result?.subQuestions[i] ?? null}
          />
        );
      })}
    </div>
  );
}
