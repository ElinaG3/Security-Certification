'use client';

import { useEffect, useRef, useState } from 'react';
import { submitAnswer, flagCard, overrideFillInAnswer, type SubmitAnswerResult } from '../../app/study/actions';
import type {
  PublicCard,
  PublicMultipleChoiceContent,
  PublicMultipleSelectContent,
  PublicArtifactPbqContent,
  PublicRemediationSelectContent,
  PublicFillInContent,
} from '@/lib/question-public';
import { ArtifactPbqCard } from './pbq/ArtifactPbqCard';
import { RemediationSelectCard } from './pbq/RemediationSelectCard';

// How long the Reveal button stays disabled after submitting an answer —
// the elaboration pause. Pressing the skip shortcut before this elapses is
// logged as a skip; waiting it out (via the button or the shortcut) is not.
const GATE_MS = 4000;
const SKIP_KEY = 's';

type Phase = 'answering' | 'gated' | 'revealed' | 'summary';

type Selection = number[] | number[][] | string;

interface HistoryEntry {
  card: PublicCard;
  selected: Selection;
  result: SubmitAnswerResult;
}

function answerText(content: PublicMultipleChoiceContent | PublicMultipleSelectContent, indices: number[]): string {
  return indices.map((i) => content.options[i]).join(', ') || '(no answer)';
}

function initialSelected(card: PublicCard): Selection {
  if (card.type === 'log_analysis' || card.type === 'config_table') {
    const content = card.content as PublicArtifactPbqContent;
    return content.subQuestions.map(() => []);
  }
  if (card.type === 'fill_in') return '';
  return [];
}

function canSubmitCard(card: PublicCard, selected: Selection): boolean {
  if (card.type === 'multiple_choice') {
    return (selected as number[]).length === 1;
  }
  if (card.type === 'multiple_select') {
    const requiredCount = (card.content as PublicMultipleSelectContent).requiredCount;
    return (selected as number[]).length === requiredCount;
  }
  if (card.type === 'remediation_select') {
    return true; // an empty/full selection is a valid (poorly-scored) attempt, not a blocked state
  }
  if (card.type === 'fill_in') {
    return (selected as string).trim() !== '';
  }
  const content = card.content as PublicArtifactPbqContent;
  const sel = selected as number[][];
  return content.subQuestions.every((sq, i) => {
    const s = sel[i] ?? [];
    if (sq.answerMode === 'cell_value') {
      return sq.rows.every((_, rowPos) => s[rowPos] !== undefined);
    }
    const required = sq.requiredCount ?? 1;
    return s.length === required;
  });
}

function resultBanner(result: SubmitAnswerResult): { label: string; color: string } {
  if (result.score >= 1) return { label: 'Correct', color: '#2e7d32' };
  if (result.score <= 0) return { label: 'Incorrect', color: '#c0392b' };
  return { label: `Partially correct (${Math.round(result.score * 100)}%)`, color: '#b8860b' };
}

function ChoiceCardView({
  card,
  selected,
  onChange,
  locked,
  result,
}: {
  card: PublicCard;
  selected: number[];
  onChange: (v: number[]) => void;
  locked: boolean;
  result: Extract<SubmitAnswerResult, { kind: 'choice' }> | null;
}) {
  const content = card.content as PublicMultipleChoiceContent | PublicMultipleSelectContent;
  const isMultiSelect = card.type === 'multiple_select';
  const requiredCount = 'requiredCount' in content ? content.requiredCount : 1;

  function toggleOption(idx: number) {
    if (locked) return;
    if (isMultiSelect) {
      onChange(selected.includes(idx) ? selected.filter((i) => i !== idx) : [...selected, idx]);
    } else {
      onChange([idx]);
    }
  }

  const correctSet = result
    ? new Set(Array.isArray(result.correctAnswer) ? result.correctAnswer : [result.correctAnswer])
    : null;

  return (
    <div>
      <h2>{content.question}</h2>
      {isMultiSelect && !result && <p style={{ color: '#666' }}>Select {requiredCount}.</p>}

      <ul style={{ listStyle: 'none', padding: 0, margin: '16px 0' }}>
        {content.options.map((opt, idx) => {
          const isSelected = selected.includes(idx);
          let background = '#fff';
          if (correctSet) {
            if (correctSet.has(idx)) background = '#d4f4dd';
            else if (isSelected) background = '#f8d7da';
          } else if (isSelected) {
            background = '#e7f0ff';
          }
          const showDistractorNote = correctSet && !correctSet.has(idx) && result?.distractorExplanations?.[idx];

          return (
            <li key={idx} style={{ marginBottom: 8 }}>
              <button
                type="button"
                onClick={() => toggleOption(idx)}
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
                {opt}
                {showDistractorNote && (
                  <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
                    {result!.distractorExplanations![idx]}
                  </div>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function FillInCardView({
  content,
  selected,
  onChange,
  locked,
  result,
}: {
  content: PublicFillInContent;
  selected: string;
  onChange: (v: string) => void;
  locked: boolean;
  result: Extract<SubmitAnswerResult, { kind: 'fill_in' }> | null;
}) {
  const background = result ? (result.score >= 1 ? '#d4f4dd' : result.score > 0 ? '#fdf6e3' : '#f8d7da') : '#fff';
  const fieldStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #ccc',
    borderRadius: 6,
    font: 'inherit',
    background,
  };

  return (
    <div>
      <h2>{content.question}</h2>
      {content.gradingMode === 'ai' ? (
        <textarea
          value={selected}
          onChange={(e) => onChange(e.target.value)}
          disabled={locked}
          autoFocus
          rows={3}
          style={{ ...fieldStyle, resize: 'vertical' }}
        />
      ) : (
        <input type="text" value={selected} onChange={(e) => onChange(e.target.value)} disabled={locked} autoFocus style={fieldStyle} />
      )}
      {result && result.gradingMode === 'exact' && !result.correct && (
        <p style={{ fontSize: 13, color: '#666', marginTop: 6 }}>Accepted answer: {result.correctAnswer}</p>
      )}
      {result && result.gradingMode === 'ai' && result.reason && (
        <p style={{ fontSize: 13, color: '#666', marginTop: 6 }}>{result.reason}</p>
      )}
    </div>
  );
}

export function StudySession({ initialCards }: { initialCards: PublicCard[] }) {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('answering');
  const [selected, setSelected] = useState<Selection>(() => initialSelected(initialCards[0]));
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [pendingResponseMs, setPendingResponseMs] = useState<number | null>(null);
  const [gateStartedAt, setGateStartedAt] = useState<number | null>(null);
  const [canReveal, setCanReveal] = useState(false);
  const [result, setResult] = useState<SubmitAnswerResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [flaggedIds, setFlaggedIds] = useState<Set<string>>(new Set());
  const [flagging, setFlagging] = useState(false);
  const [overriding, setOverriding] = useState(false);
  const [overridden, setOverridden] = useState(false);
  const [overrideError, setOverrideError] = useState<string | null>(null);
  const revealingRef = useRef(false);

  const card = initialCards[index];

  useEffect(() => {
    if (phase !== 'gated') return;
    const timer = setTimeout(() => setCanReveal(true), GATE_MS);
    return () => clearTimeout(timer);
  }, [phase, index]);

  useEffect(() => {
    if (phase !== 'gated') return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key.toLowerCase() === SKIP_KEY) {
        e.preventDefault();
        reveal();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, gateStartedAt]);

  async function reveal() {
    if (revealingRef.current || pendingResponseMs === null) return;
    revealingRef.current = true;
    setSubmitting(true);
    const gateStart = gateStartedAt ?? Date.now();
    const elaborationSkipped = Date.now() - gateStart < GATE_MS;
    const optionOrder =
      card.type === 'multiple_choice' || card.type === 'multiple_select'
        ? (card.content as PublicMultipleChoiceContent | PublicMultipleSelectContent).optionOrder
        : undefined;
    const res = await submitAnswer({
      cardId: card.id,
      selected,
      responseMs: pendingResponseMs,
      elaborationSkipped,
      optionOrder,
    });
    setResult(res);
    setHistory((h) => [...h, { card, selected, result: res }]);
    setPhase('revealed');
    setSubmitting(false);
  }

  if (phase === 'summary') {
    return <ResultsScreen history={history} />;
  }

  if (!card) return null;

  const isLast = index === initialCards.length - 1;
  const canSubmit = canSubmitCard(card, selected);
  const locked = phase !== 'answering';

  const isFlagged = flaggedIds.has(card.id);

  async function handleFlag() {
    if (flagging || isFlagged) return;
    setFlagging(true);
    try {
      await flagCard({ cardId: card.id });
      setFlaggedIds((s) => new Set(s).add(card.id));
    } finally {
      setFlagging(false);
    }
  }

  function handleSubmitClick() {
    const responseMs = Date.now() - startedAt;
    revealingRef.current = false;
    setPendingResponseMs(responseMs);
    setGateStartedAt(Date.now());
    setCanReveal(false);
    setPhase('gated');
  }

  function handleNext() {
    const nextCard = initialCards[index + 1];
    setIndex((i) => i + 1);
    setPhase('answering');
    setSelected(initialSelected(nextCard));
    setResult(null);
    setPendingResponseMs(null);
    setGateStartedAt(null);
    setCanReveal(false);
    setStartedAt(Date.now());
    setOverridden(false);
    setOverrideError(null);
  }

  // "I was right" — the typed answer was marked wrong but was actually
  // correct. Only offered when result.score === 0 (genuinely wrong, not a
  // partial-credit explanation grade) on a fill_in card.
  async function handleOverride() {
    if (overriding || overridden || !result || result.kind !== 'fill_in') return;
    setOverriding(true);
    setOverrideError(null);
    try {
      const res = await overrideFillInAnswer({ reviewLogId: result.reviewLogId, userAnswer: selected as string });
      if (res.ok) {
        setOverridden(true);
      } else {
        setOverrideError(res.issue);
      }
    } finally {
      setOverriding(false);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <p style={{ color: '#666', margin: 0 }}>
          {card.domain} — {card.topic} ({index + 1}/{initialCards.length})
        </p>
        <button
          type="button"
          onClick={handleFlag}
          disabled={flagging || isFlagged}
          title="Pull this card out of rotation — review it later at /review"
          style={{
            fontSize: 12,
            padding: '4px 8px',
            border: '1px solid #ccc',
            borderRadius: 6,
            background: isFlagged ? '#fdf4f4' : '#fff',
            color: isFlagged ? '#c0392b' : '#666',
            cursor: flagging || isFlagged ? 'default' : 'pointer',
          }}
        >
          {isFlagged ? '🚩 Flagged' : '🚩 Flag'}
        </button>
      </div>

      {card.type === 'multiple_choice' || card.type === 'multiple_select' ? (
        <ChoiceCardView
          card={card}
          selected={selected as number[]}
          onChange={setSelected}
          locked={locked}
          result={result?.kind === 'choice' ? result : null}
        />
      ) : card.type === 'remediation_select' ? (
        <RemediationSelectCard
          content={card.content as PublicRemediationSelectContent}
          selected={selected as number[]}
          onChange={setSelected}
          locked={locked}
          result={result?.kind === 'remediation' ? result : null}
        />
      ) : card.type === 'fill_in' ? (
        <FillInCardView
          content={card.content as PublicFillInContent}
          selected={selected as string}
          onChange={setSelected}
          locked={locked}
          result={result?.kind === 'fill_in' ? result : null}
        />
      ) : (
        <ArtifactPbqCard
          content={card.content as PublicArtifactPbqContent}
          selected={selected as number[][]}
          onChange={(subIndex, values) =>
            setSelected((prev) => {
              const next = [...(prev as number[][])];
              next[subIndex] = values;
              return next;
            })
          }
          locked={locked}
          result={result?.kind === 'artifact_pbq' ? result : null}
        />
      )}

      {phase === 'answering' && (
        <button onClick={handleSubmitClick} disabled={!canSubmit}>
          Submit
        </button>
      )}

      {phase === 'gated' && (
        <div>
          <p style={{ fontStyle: 'italic' }}>
            Why is your answer right, and why is one other option wrong? Say it out loud.
          </p>
          <button onClick={reveal} disabled={!canReveal || submitting}>
            {submitting ? 'Revealing...' : 'Reveal'}
          </button>
          <p style={{ fontSize: 13, color: '#666', marginTop: 6 }}>
            {canReveal ? `Or press "${SKIP_KEY.toUpperCase()}" to skip.` : `Know it cold? Press "${SKIP_KEY.toUpperCase()}" to skip the wait.`}
          </p>
        </div>
      )}

      {phase === 'revealed' && result && (
        <div style={{ marginTop: 16 }}>
          <p style={{ fontWeight: 700, color: resultBanner(result).color }}>{resultBanner(result).label}</p>
          {result.kind === 'choice' && <p>{result.explanation}</p>}
          {result.kind === 'choice' && result.mnemonic && (
            <p style={{ fontStyle: 'italic', color: '#555' }}>Mnemonic: {result.mnemonic}</p>
          )}
          {result.kind === 'fill_in' && result.score === 0 && (
            <div style={{ margin: '8px 0' }}>
              {overridden ? (
                <p style={{ fontSize: 13, color: '#2e7d32' }}>✓ Marked correct. Your answer was added to this card.</p>
              ) : (
                <>
                  <button type="button" onClick={handleOverride} disabled={overriding} style={{ fontSize: 13 }}>
                    {overriding ? 'Marking...' : 'I was right'}
                  </button>
                  {overrideError && <p style={{ fontSize: 12, color: '#c0392b', marginTop: 4 }}>{overrideError}</p>}
                </>
              )}
            </div>
          )}
          {isLast ? (
            <button onClick={() => setPhase('summary')}>See results</button>
          ) : (
            <button onClick={handleNext}>Next</button>
          )}
        </div>
      )}
    </div>
  );
}

function ChoiceResultDetail({
  card,
  result,
  selected,
}: {
  card: PublicCard;
  result: Extract<SubmitAnswerResult, { kind: 'choice' }>;
  selected: number[];
}) {
  const content = card.content as PublicMultipleChoiceContent | PublicMultipleSelectContent;
  const correctIndices = Array.isArray(result.correctAnswer) ? result.correctAnswer : [result.correctAnswer];
  return (
    <>
      <p style={{ fontWeight: 600, marginBottom: 8 }}>{content.question}</p>
      <p>Your answer: {answerText(content, selected)}</p>
      <p>Correct answer: {answerText(content, correctIndices)}</p>
      <p style={{ color: '#444', marginTop: 8 }}>{result.explanation}</p>
      {result.mnemonic && <p style={{ fontStyle: 'italic', color: '#555' }}>Mnemonic: {result.mnemonic}</p>}
    </>
  );
}

function ArtifactPbqResultDetail({
  card,
  result,
}: {
  card: PublicCard;
  result: Extract<SubmitAnswerResult, { kind: 'artifact_pbq' }>;
}) {
  const content = card.content as PublicArtifactPbqContent;
  return (
    <>
      {content.scenario && <p style={{ marginBottom: 8 }}>{content.scenario}</p>}
      {content.subQuestions.map((sq, i) => {
        const sqResult = result.subQuestions[i];
        return (
          <div key={i} style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #eee' }}>
            <p style={{ fontWeight: 600 }}>{sq.question}</p>
            <p style={{ color: sqResult.correct ? '#2e7d32' : '#c0392b', fontWeight: 600, fontSize: 14 }}>
              {sqResult.correct ? 'Correct' : 'Incorrect'}
            </p>
            {sqResult.options.map((opt) => (
              <p
                key={opt.index}
                style={{ fontSize: 13, color: opt.correct ? '#2e7d32' : opt.selected ? '#c0392b' : '#666', margin: '2px 0' }}
              >
                {opt.explanation}
              </p>
            ))}
          </div>
        );
      })}
    </>
  );
}

function RemediationResultDetail({
  card,
  result,
}: {
  card: PublicCard;
  result: Extract<SubmitAnswerResult, { kind: 'remediation' }>;
}) {
  const content = card.content as PublicRemediationSelectContent;
  return (
    <>
      <p style={{ marginBottom: 8 }}>{content.scenario}</p>
      <p style={{ fontWeight: 600, marginBottom: 8 }}>{content.question}</p>
      {result.options.map((opt) => (
        <p
          key={opt.index}
          style={{ fontSize: 13, color: opt.correct ? '#2e7d32' : opt.selected ? '#c0392b' : '#666', margin: '2px 0' }}
        >
          {opt.selected ? '☑' : '☐'} {content.actions[opt.index]} — {opt.explanation}
        </p>
      ))}
    </>
  );
}

function FillInResultDetail({
  content,
  selected,
  result,
}: {
  content: PublicFillInContent;
  selected: string;
  result: Extract<SubmitAnswerResult, { kind: 'fill_in' }>;
}) {
  return (
    <>
      <p style={{ fontWeight: 600, marginBottom: 8 }}>{content.question}</p>
      <p>Your answer: {selected || '(no answer)'}</p>
      {result.gradingMode === 'exact' && !result.correct && <p>Accepted answer: {result.correctAnswer}</p>}
      {result.gradingMode === 'ai' && result.reason && <p style={{ color: '#666' }}>{result.reason}</p>}
      <p style={{ color: '#444', marginTop: 8 }}>{result.explanation}</p>
    </>
  );
}

function ResultsEntry({ entry }: { entry: HistoryEntry }) {
  const { card, result } = entry;
  const banner = resultBanner(result);
  const background = result.score >= 1 ? '#f4fbf6' : result.score <= 0 ? '#fdf4f4' : '#fffdf4';

  return (
    <div style={{ border: '1px solid #ccc', borderRadius: 6, padding: 14, marginBottom: 12, background }}>
      <p style={{ color: '#666', marginBottom: 4, fontSize: 13 }}>
        {card.domain} — {card.topic}
      </p>
      <p style={{ fontWeight: 700, color: banner.color, marginBottom: 8 }}>{banner.label}</p>

      {result.kind === 'choice' && <ChoiceResultDetail card={card} result={result} selected={entry.selected as number[]} />}
      {result.kind === 'artifact_pbq' && <ArtifactPbqResultDetail card={card} result={result} />}
      {result.kind === 'remediation' && <RemediationResultDetail card={card} result={result} />}
      {result.kind === 'fill_in' && (
        <FillInResultDetail content={card.content as PublicFillInContent} selected={entry.selected as string} result={result} />
      )}
    </div>
  );
}

function ResultsScreen({ history }: { history: HistoryEntry[] }) {
  const total = history.length;
  const correctCount = history.filter((h) => h.result.score >= 1).length;
  // Stable sort: wrong/partial answers first, correct answers after,
  // original session order preserved within each group — this is the
  // elaboration moment for the whole session, so the cards that need it
  // most lead.
  const sorted = [...history].sort((a, b) => a.result.score - b.result.score);

  return (
    <div>
      <h2>Results</h2>
      <p style={{ color: '#666', marginBottom: 20 }}>
        {correctCount} of {total} correct.
      </p>

      {sorted.map((entry) => (
        <ResultsEntry key={entry.card.id} entry={entry} />
      ))}
    </div>
  );
}
