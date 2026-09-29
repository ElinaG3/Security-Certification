'use client';

import { useEffect, useState } from 'react';

export function StageNewCards({
  onGenerate,
  onFlag,
  onContinue,
}: {
  onGenerate: () => Promise<{ createdCards: { id: string; question: string }[]; skippedErrorCount: number }>;
  onFlag: (cardId: string) => Promise<void>;
  onContinue: () => void;
}) {
  const [result, setResult] = useState<{ createdCards: { id: string; question: string }[]; skippedErrorCount: number } | null>(null);
  const [flagged, setFlagged] = useState<Set<string>>(new Set());

  useEffect(() => {
    onGenerate().then(setResult);
    // Generation is triggered once, on arriving at this step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleFlag(cardId: string) {
    await onFlag(cardId);
    setFlagged((prev) => new Set(prev).add(cardId));
  }

  if (!result) {
    return (
      <div>
        <h2 style={{ fontSize: 20, marginBottom: 4 }}>C4 · Mistakes become cards</h2>
        <p style={{ color: '#666' }}>Writing practice cards for today&apos;s mistakes...</p>
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ fontSize: 20, marginBottom: 4 }}>C4 · Mistakes become cards</h2>

      {result.createdCards.length === 0 ? (
        <p style={{ color: '#666', marginBottom: 12 }}>No mistakes to turn into cards today.</p>
      ) : (
        result.createdCards.map((card) => (
          <div key={card.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, margin: '6px 0' }}>
            <p style={{ margin: 0 }}>{card.question}</p>
            <button type="button" onClick={() => handleFlag(card.id)} disabled={flagged.has(card.id)} style={{ flexShrink: 0 }}>
              {flagged.has(card.id) ? 'Flagged' : 'Flag'}
            </button>
          </div>
        ))
      )}

      {result.skippedErrorCount > 0 && (
        <p style={{ color: '#666', marginTop: 12 }}>
          {result.skippedErrorCount} more error{result.skippedErrorCount === 1 ? '' : 's'} saved in your error log.
        </p>
      )}

      <button type="button" onClick={onContinue} style={{ marginTop: 16 }}>
        Continue
      </button>
    </div>
  );
}
