'use client';

import { useState } from 'react';
import type { RoutineError } from '@/lib/routine';

export function StageErrorLog({
  onSubmit,
  onContinue,
}: {
  onSubmit: (userErrorText: string) => Promise<{ actualErrors: RoutineError[]; forgotten: string[] }>;
  onContinue: () => void;
}) {
  const [userErrorText, setUserErrorText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ actualErrors: RoutineError[]; forgotten: string[] } | null>(null);

  async function handleSubmit() {
    setSubmitting(true);
    const res = await onSubmit(userErrorText);
    setResult(res);
    setSubmitting(false);
  }

  if (result) {
    const forgottenSet = new Set(result.forgotten);
    return (
      <div>
        <h2 style={{ fontSize: 20, marginBottom: 4 }}>C3 · Error log from memory</h2>
        <p style={{ color: '#666', marginBottom: 12 }}>What you wrote:</p>
        <p style={{ whiteSpace: 'pre-wrap', marginBottom: 16, color: '#666' }}>{userErrorText || '(nothing written)'}</p>

        <p style={{ color: '#666', marginBottom: 8 }}>What actually went wrong or was missed today:</p>
        {result.actualErrors.length === 0 ? (
          <p style={{ color: '#666' }}>Nothing — a clean session.</p>
        ) : (
          result.actualErrors.map((e, i) => (
            <p
              key={i}
              style={{
                margin: '4px 0',
                background: forgottenSet.has(e.text) ? '#fdf4d8' : 'transparent',
                padding: forgottenSet.has(e.text) ? '2px 4px' : 0,
              }}
            >
              {forgottenSet.has(e.text) ? '⚠️ (forgot this one) ' : ''}
              {e.text}
            </p>
          ))
        )}

        <button type="button" onClick={onContinue} style={{ marginTop: 16 }}>
          Continue
        </button>
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ fontSize: 20, marginBottom: 4 }}>C3 · Error log from memory</h2>
      <label style={{ display: 'block', marginBottom: 6, fontSize: 14 }}>Write down everything you got wrong or missed today.</label>
      <textarea
        value={userErrorText}
        onChange={(e) => setUserErrorText(e.target.value)}
        rows={8}
        style={{ width: '100%', padding: 8, fontSize: 14, marginBottom: 16 }}
      />
      <button type="button" onClick={handleSubmit} disabled={submitting}>
        {submitting ? 'Checking...' : 'Submit'}
      </button>
    </div>
  );
}
