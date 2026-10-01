'use client';

import { useState } from 'react';
import { TranslateIcon } from '@/components/icons';
import { lookupTerm } from '../../../app/words/actions';

interface Shown {
  translationDe: string;
  contextNote: string;
  lookupCount: number;
}

// Mounted once in the root layout — a global "look this up" tool available
// from any page, not tied to any one study flow.
export function WordTranslatorWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [result, setResult] = useState<Shown | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleOpen() {
    const selected = window.getSelection?.()?.toString().trim();
    setInput(selected || '');
    setResult(null);
    setError(null);
    setOpen(true);
  }

  async function handleTranslate() {
    if (!input.trim() || loading) return;
    setLoading(true);
    setError(null);
    const res = await lookupTerm(input);
    setLoading(false);
    if (!res.ok) {
      setResult(null);
      setError(res.error);
      return;
    }
    setResult({ translationDe: res.term.translationDe, contextNote: res.term.contextNote, lookupCount: res.term.lookupCount });
  }

  if (!open) {
    return (
      <button type="button" className="word-fab" onClick={handleOpen} aria-label="Translate a word">
        <TranslateIcon size={22} />
      </button>
    );
  }

  return (
    <div className="card word-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <strong style={{ fontFamily: 'var(--font-heading)', fontSize: 16 }}>Translate</strong>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close"
          style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 20, lineHeight: 1, color: 'var(--text-secondary)', minHeight: 44, minWidth: 44 }}
        >
          ×
        </button>
      </div>

      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleTranslate();
        }}
        placeholder="English word or term"
        autoFocus
        style={{ width: '100%', minHeight: 44, padding: '0 10px', marginBottom: 8, borderRadius: 8, border: '1px solid var(--card-border)', fontSize: 14 }}
      />

      <button type="button" className="btn btn-primary" onClick={handleTranslate} disabled={loading || !input.trim()} style={{ width: '100%' }}>
        {loading ? 'Translating...' : 'Translate'}
      </button>

      {error && <p style={{ color: '#c0392b', fontSize: 13, marginTop: 10 }}>{error}</p>}

      {result && (
        <div style={{ marginTop: 12 }}>
          <p style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>{result.translationDe}</p>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 8px' }}>{result.contextNote}</p>
          <p style={{ fontSize: 12, margin: 0, color: result.lookupCount >= 3 ? 'var(--accent)' : 'var(--text-secondary)', fontWeight: result.lookupCount >= 3 ? 600 : 400 }}>
            {result.lookupCount >= 3
              ? `You have looked this up ${result.lookupCount} times`
              : `Looked up ${result.lookupCount} time${result.lookupCount === 1 ? '' : 's'}`}
          </p>
        </div>
      )}
    </div>
  );
}
