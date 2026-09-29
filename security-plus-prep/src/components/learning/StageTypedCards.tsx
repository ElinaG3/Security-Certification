'use client';

import { useEffect, useState } from 'react';
import type { PublicCard, PublicFillInContent } from '@/lib/question-public';

type LastResult = {
  correct: boolean;
  explanation: string;
  correctAnswer?: string;
  reviewLogId?: string;
  overridden: boolean;
};

export function StageTypedCards({
  totalCount,
  loadRemaining,
  onAnswer,
  onOverride,
  onAllDone,
}: {
  totalCount: number;
  loadRemaining: () => Promise<PublicCard[]>;
  onAnswer: (cardId: string, answer: string, responseMs: number) => Promise<{ correct: boolean; explanation: string; correctAnswer?: string; reviewLogId?: string; allDone: boolean }>;
  onOverride: (reviewLogId: string, userAnswer: string) => Promise<boolean>;
  onAllDone: () => void;
}) {
  const [remaining, setRemaining] = useState<PublicCard[] | null>(null);
  const [answer, setAnswer] = useState('');
  const [startedAt, setStartedAt] = useState(0);
  const [result, setResult] = useState<LastResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadRemaining().then((cards) => {
      setRemaining(cards);
      setStartedAt(Date.now());
    });
    // Only ever loads once per mount of this stage — the queue is fixed
    // server-side at C1 submit time, so there's nothing to re-fetch on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (remaining === null) return <p>Loading cards...</p>;

  const current = remaining[0];

  async function handleSubmit() {
    if (!current) return;
    setSubmitting(true);
    const responseMs = Date.now() - startedAt;
    const res = await onAnswer(current.id, answer, responseMs);
    setResult({ correct: res.correct, explanation: res.explanation, correctAnswer: res.correctAnswer, reviewLogId: res.reviewLogId, overridden: false });
    setSubmitting(false);
  }

  async function handleOverride() {
    if (!result?.reviewLogId) return;
    const ok = await onOverride(result.reviewLogId, answer);
    if (ok) setResult((prev) => (prev ? { ...prev, correct: true, overridden: true } : prev));
  }

  function handleNext() {
    if (!remaining) return;
    const next = remaining.slice(1);
    setResult(null);
    setAnswer('');
    setStartedAt(Date.now());
    if (next.length === 0) {
      onAllDone();
    } else {
      setRemaining(next);
    }
  }

  const content = current?.content as PublicFillInContent | undefined;
  const doneCount = totalCount - remaining.length;

  return (
    <div>
      <h2 style={{ fontSize: 20, marginBottom: 4 }}>C2 · Due typed cards</h2>
      <p style={{ color: '#666', marginBottom: 16 }}>
        {doneCount + (current ? 1 : 0)}/{totalCount}
      </p>

      {current && content ? (
        <div>
          <p style={{ marginBottom: 12 }}>{content.question}</p>
          <input
            type="text"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            disabled={result !== null}
            style={{ width: '100%', padding: 8, fontSize: 14, marginBottom: 12 }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !result) handleSubmit();
            }}
          />

          {result ? (
            <div style={{ marginBottom: 12 }}>
              <p style={{ color: result.correct ? '#2e7d32' : '#c0392b', fontWeight: 600 }}>{result.correct ? 'Correct' : 'Wrong'}</p>
              {result.correctAnswer && !result.correct && <p style={{ color: '#666' }}>Correct answer: {result.correctAnswer}</p>}
              <p style={{ color: '#666' }}>{result.explanation}</p>
              {!result.correct && !result.overridden && result.reviewLogId && (
                <button type="button" onClick={handleOverride} style={{ marginTop: 8 }}>
                  I was right
                </button>
              )}
              <button type="button" onClick={handleNext} style={{ marginTop: 8, marginLeft: 8 }}>
                Next
              </button>
            </div>
          ) : (
            <button type="button" onClick={handleSubmit} disabled={submitting || answer.trim() === ''}>
              {submitting ? 'Checking...' : 'Submit'}
            </button>
          )}
        </div>
      ) : (
        <p>No cards due — moving on.</p>
      )}
    </div>
  );
}
