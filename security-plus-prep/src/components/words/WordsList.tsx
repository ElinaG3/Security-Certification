'use client';

import { useState } from 'react';
import { listTerms, deleteTerm, type VocabTermRow } from '../../../app/words/actions';

type Sort = 'most_looked_up' | 'newest';

export function WordsList({ initialTerms, initialSort }: { initialTerms: VocabTermRow[]; initialSort: Sort }) {
  const [terms, setTerms] = useState(initialTerms);
  const [sort, setSort] = useState<Sort>(initialSort);
  const [loading, setLoading] = useState(false);

  async function handleSort(next: Sort) {
    if (next === sort) return;
    setSort(next);
    setLoading(true);
    setTerms(await listTerms(next));
    setLoading(false);
  }

  async function handleDelete(id: string) {
    await deleteTerm(id);
    setTerms((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button type="button" className={`pill ${sort === 'most_looked_up' ? 'pill-tint' : 'pill-neutral'}`} onClick={() => handleSort('most_looked_up')}>
          Most looked up
        </button>
        <button type="button" className={`pill ${sort === 'newest' ? 'pill-tint' : 'pill-neutral'}`} onClick={() => handleSort('newest')}>
          Newest
        </button>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>
      ) : terms.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)' }}>No saved words yet — look one up with the translate button.</p>
      ) : (
        terms.map((t) => (
          <div key={t.id} className="card" style={{ padding: 12, marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <strong>{t.term}</strong>
              <button
                type="button"
                onClick={() => handleDelete(t.id)}
                style={{ border: 'none', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, minHeight: 44 }}
              >
                Delete
              </button>
            </div>
            <p style={{ margin: '4px 0' }}>{t.translationDe}</p>
            <p style={{ margin: '4px 0', color: 'var(--text-secondary)', fontSize: 13 }}>{t.contextNote}</p>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>
              Looked up {t.lookupCount} time{t.lookupCount === 1 ? '' : 's'} — last {new Date(t.lastLookedUpAt).toLocaleDateString()}
            </p>
          </div>
        ))
      )}
    </div>
  );
}
