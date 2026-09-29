'use client';

import { useState } from 'react';
import type { GapReport } from '@/lib/recall-grading';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export function StageRecall({
  topic,
  onSubmit,
  onContinue,
}: {
  topic: string;
  onSubmit: (abcAnswers: Record<string, string>, freeRecallText: string) => Promise<{ gapReport: GapReport; score: number }>;
  onContinue: () => void;
}) {
  const [abcAnswers, setAbcAnswers] = useState<Record<string, string>>({});
  const [freeRecallText, setFreeRecallText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ gapReport: GapReport; score: number } | null>(null);

  async function handleSubmit() {
    setSubmitting(true);
    const res = await onSubmit(abcAnswers, freeRecallText);
    setResult(res);
    setSubmitting(false);
  }

  if (result) {
    return (
      <div>
        <h2 style={{ fontSize: 20, marginBottom: 4 }}>C1 · Yesterday&apos;s recall</h2>
        <p style={{ color: '#666', marginBottom: 16 }}>
          {topic} — {Math.round(result.score * 100)}% of key points covered
        </p>
        {result.gapReport.correct.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            {result.gapReport.correct.map((c, i) => (
              <p key={i} style={{ margin: '4px 0' }}>✅ {c}</p>
            ))}
          </div>
        )}
        {result.gapReport.errors.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            {result.gapReport.errors.map((e, i) => (
              <p key={i} style={{ margin: '4px 0' }}>❌ {e}</p>
            ))}
          </div>
        )}
        {result.gapReport.missed.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            {result.gapReport.missed.map((m, i) => (
              <p key={i} style={{ margin: '4px 0' }}>➕ {m}</p>
            ))}
          </div>
        )}
        <button type="button" onClick={onContinue} style={{ marginTop: 8 }}>
          Continue to typed cards
        </button>
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ fontSize: 20, marginBottom: 4 }}>C1 · Yesterday&apos;s recall</h2>
      <p style={{ color: '#666', marginBottom: 16 }}>Topic: {topic}</p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))',
          gap: 6,
          marginBottom: 16,
        }}
      >
        {LETTERS.map((letter) => (
          <div key={letter}>
            <label style={{ fontSize: 11, color: '#999' }}>{letter}</label>
            <input
              type="text"
              value={abcAnswers[letter] ?? ''}
              onChange={(e) => setAbcAnswers((prev) => ({ ...prev, [letter]: e.target.value }))}
              style={{ width: '100%', padding: 4, fontSize: 13 }}
            />
          </div>
        ))}
      </div>

      <label style={{ display: 'block', marginBottom: 6, fontSize: 14 }}>Write everything else you remember.</label>
      <textarea
        value={freeRecallText}
        onChange={(e) => setFreeRecallText(e.target.value)}
        rows={8}
        style={{ width: '100%', padding: 8, fontSize: 14, marginBottom: 16 }}
      />

      <button type="button" onClick={handleSubmit} disabled={submitting}>
        {submitting ? 'Checking with AI...' : 'Check with AI'}
      </button>
    </div>
  );
}
