'use client';

import { useState } from 'react';
import { submitAnswer, type SubmitAnswerResult } from '../../app/study/actions';
import type { PublicCard } from '@/lib/question-public';

export function StudySession({ initialCards }: { initialCards: PublicCard[] }) {
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<SubmitAnswerResult | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [submitting, setSubmitting] = useState(false);

  const card = initialCards[index];
  if (!card) return <p>Session complete.</p>;

  const isMultiSelect = card.type === 'multiple_select';
  const requiredCount = 'requiredCount' in card.content ? card.content.requiredCount : 1;
  const isLast = index === initialCards.length - 1;
  const canSubmit = isMultiSelect ? selected.length === requiredCount : selected.length === 1;

  function toggleOption(idx: number) {
    if (result) return; // locked after submit
    if (isMultiSelect) {
      setSelected((prev) => (prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]));
    } else {
      setSelected([idx]);
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    const responseMs = Date.now() - startedAt;
    const res = await submitAnswer({ cardId: card.id, selected, responseMs });
    setResult(res);
    setSubmitting(false);
  }

  function handleNext() {
    setIndex((i) => i + 1);
    setResult(null);
    setSelected([]);
    setStartedAt(Date.now());
  }

  const correctSet = result
    ? new Set(Array.isArray(result.correctAnswer) ? result.correctAnswer : [result.correctAnswer])
    : null;

  return (
    <div>
      <p style={{ color: '#666', marginBottom: 8 }}>
        {card.domain} — {card.topic} ({index + 1}/{initialCards.length})
      </p>
      <h2>{card.content.question}</h2>
      {isMultiSelect && !result && <p style={{ color: '#666' }}>Select {requiredCount}.</p>}

      <ul style={{ listStyle: 'none', padding: 0, margin: '16px 0' }}>
        {card.content.options.map((opt, idx) => {
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
                disabled={!!result}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '10px 14px',
                  background,
                  border: '1px solid #ccc',
                  borderRadius: 6,
                  cursor: result ? 'default' : 'pointer',
                }}
              >
                {opt}
                {showDistractorNote && (
                  <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
                    {result.distractorExplanations![idx]}
                  </div>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {!result ? (
        <button onClick={handleSubmit} disabled={!canSubmit || submitting}>
          {submitting ? 'Submitting...' : 'Submit'}
        </button>
      ) : (
        <div>
          <p style={{ fontWeight: 700, color: result.correct ? '#2e7d32' : '#c0392b' }}>
            {result.correct ? 'Correct' : 'Incorrect'}
          </p>
          <p>{result.explanation}</p>
          {isLast ? <p>Session complete.</p> : <button onClick={handleNext}>Next</button>}
        </div>
      )}
    </div>
  );
}
