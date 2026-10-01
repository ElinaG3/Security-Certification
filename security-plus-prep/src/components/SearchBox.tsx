'use client';

import { useState } from 'react';
import { search } from '../../app/search/actions';
import type { ChunkSearchResult } from '@/lib/search';

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid #ccc',
  borderRadius: 6,
  font: 'inherit',
};

export function SearchBox() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ChunkSearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim() === '') return;
    setSearching(true);
    setError(null);
    try {
      setResults(await search(query));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSearching(false);
    }
  }

  return (
    <div>
      <form onSubmit={runSearch} style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. salted password hashing, zero trust, change management steps..."
          style={inputStyle}
          autoFocus
        />
        <button type="submit" disabled={searching || query.trim() === ''}>
          {searching ? 'Searching...' : 'Search'}
        </button>
      </form>

      {error && <p style={{ color: '#c0392b' }}>{error}</p>}

      {results && results.length === 0 && <p style={{ color: '#666' }}>No ingested content yet, or nothing close to that query.</p>}

      {results && results.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {results.map((r) => (
            <li
              key={r.id}
              style={{
                border: '1px solid #ddd',
                borderRadius: 8,
                padding: 14,
                marginBottom: 12,
              }}
            >
              <p style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>
                {r.sourceFile}
                {r.objective ? ` — obj ${r.objective}` : ''}
                {r.sectionTitle ? ` — ${r.sectionTitle}` : ''}
                {r.subTopic ? ` — ${r.subTopic}` : ''}
                {'  ·  '}
                {(r.similarity * 100).toFixed(0)}% match
              </p>
              <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{r.content}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
