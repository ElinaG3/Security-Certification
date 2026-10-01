'use client';

import { useEffect, useState } from 'react';
import type { StudySheetContent } from '@/lib/study-sheet-generation';
import type { ReadingSection } from '@/lib/topics';
import { generateAndCacheStudySheet } from '@/lib/topic-study-sheet';
import { StudySheetRenderer } from './StudySheetRenderer';

type View = 'sheet' | 'original';
type Status = 'idle' | 'loading' | 'error';

export function StudySheetView({
  objective,
  reading,
  initialSheet,
  needsGeneration,
}: {
  objective: string;
  reading: ReadingSection[];
  initialSheet: StudySheetContent | null;
  needsGeneration: boolean;
}) {
  const [view, setView] = useState<View>('sheet');
  const [sheet, setSheet] = useState<StudySheetContent | null>(initialSheet);
  const [status, setStatus] = useState<Status>(needsGeneration ? 'loading' : 'idle');
  const [error, setError] = useState<string | null>(null);

  function applyResult(result: Awaited<ReturnType<typeof generateAndCacheStudySheet>>) {
    if (result.ok) {
      setSheet(result.sheet);
      setStatus('idle');
    } else {
      setError(result.error);
      setStatus('error');
    }
  }

  async function generate() {
    setStatus('loading');
    setError(null);
    applyResult(await generateAndCacheStudySheet(objective, reading));
  }

  useEffect(() => {
    // The initial `status` already starts as 'loading' when needsGeneration
    // is true (see useState above), so this only needs to kick off the
    // request itself — applying the result happens in the .then() callback,
    // not synchronously in the effect body.
    if (needsGeneration) generateAndCacheStudySheet(objective, reading).then(applyResult);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleRegenerate() {
    if (window.confirm('Regenerate the study sheet? This uses one AI call.')) generate();
  }

  if (reading.length === 0) {
    return (
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20 }}>
        No source material ingested for this objective yet — upload a PDF in the Library.
      </p>
    );
  }

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" className={`pill ${view === 'sheet' ? 'pill-tint' : 'pill-neutral'}`} onClick={() => setView('sheet')}>
          Study sheet
        </button>
        <button type="button" className={`pill ${view === 'original' ? 'pill-tint' : 'pill-neutral'}`} onClick={() => setView('original')}>
          Original text
        </button>
        {view === 'sheet' && sheet && status !== 'loading' && (
          <button type="button" className="btn" style={{ marginLeft: 'auto', minHeight: 36, padding: '0 12px', fontSize: 13 }} onClick={handleRegenerate}>
            Regenerate
          </button>
        )}
      </div>

      {view === 'original' && (
        <div style={{ maxWidth: '75ch' }}>
          {reading.map((section, i) => (
            <div key={i} style={{ marginBottom: 16 }}>
              {section.sectionTitle && <p style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>{section.sectionTitle}</p>}
              <p style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--text)', whiteSpace: 'pre-wrap', overflowWrap: 'break-word' }}>{section.content}</p>
            </div>
          ))}
        </div>
      )}

      {view === 'sheet' && (
        <>
          {status === 'loading' && <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Generating study sheet...</p>}
          {status === 'error' && (
            <div>
              <p style={{ fontSize: 14, color: '#c0392b', marginBottom: 10 }}>{error}</p>
              <button type="button" className="btn" onClick={generate} style={{ marginBottom: 16 }}>
                Retry
              </button>
              <div style={{ paddingTop: 12, borderTop: '1px solid var(--card-border)', maxWidth: '75ch' }}>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>Showing the original text instead:</p>
                {reading.map((section, i) => (
                  <div key={i} style={{ marginBottom: 16 }}>
                    {section.sectionTitle && <p style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>{section.sectionTitle}</p>}
                    <p style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--text)', whiteSpace: 'pre-wrap', overflowWrap: 'break-word' }}>{section.content}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {status === 'idle' && sheet && <StudySheetRenderer sheet={sheet} />}
        </>
      )}
    </div>
  );
}
