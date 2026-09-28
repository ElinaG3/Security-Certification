'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { DomainLearningProgress } from '@/lib/dashboard';

const BAR_COLOR = '#3b6fa6';

const trackStyle: React.CSSProperties = {
  height: 8,
  borderRadius: 4,
  background: '#eee',
  overflow: 'hidden',
  flex: 1,
};

function LearnedBar({ learnedCount, totalCount }: { learnedCount: number; totalCount: number }) {
  const pct = totalCount > 0 ? (learnedCount / totalCount) * 100 : 0;
  return (
    <div style={trackStyle}>
      <div style={{ height: '100%', width: `${pct}%`, background: BAR_COLOR, borderRadius: 4 }} />
    </div>
  );
}

// Domain row expands in place to show its topics — no navigation, no
// extra data fetch, since the whole tree is small enough to send with the
// page and toggle client-side.
export function DomainLearnedRow({ data }: { data: DomainLearningProgress }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ borderBottom: '1px solid #f0f0f0' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          display: 'block',
          width: '100%',
          textAlign: 'left',
          background: 'none',
          border: 'none',
          padding: '12px 0',
          cursor: 'pointer',
          font: 'inherit',
          color: 'inherit',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, fontSize: 14, whiteSpace: 'normal', wordBreak: 'break-word' }}>
            {open ? '▾' : '▸'} {data.domain}
          </span>
          <span style={{ fontSize: 12, color: '#999', whiteSpace: 'nowrap' }}>{data.targetWeight}% of exam</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <LearnedBar learnedCount={data.learnedCount} totalCount={data.totalCount} />
          <span style={{ fontSize: 12, color: '#666', whiteSpace: 'nowrap' }}>
            {data.learnedCount} of {data.totalCount} cards learned
          </span>
        </div>
      </button>

      {open && (
        <div style={{ paddingLeft: 16, paddingBottom: 8 }}>
          {data.topics.length === 0 ? (
            <p style={{ fontSize: 13, color: '#999', margin: '4px 0 12px' }}>No topics with cards yet in this domain.</p>
          ) : (
            data.topics.map((t) => (
              <Link
                key={t.objective}
                href={`/topics/${encodeURIComponent(t.objective)}`}
                style={{ display: 'block', padding: '8px 0', borderBottom: '1px solid #f5f5f5' }}
              >
                <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, whiteSpace: 'normal', wordBreak: 'break-word' }}>{t.label}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <LearnedBar learnedCount={t.learnedCount} totalCount={t.totalCount} />
                  <span style={{ fontSize: 12, color: '#666', whiteSpace: 'nowrap' }}>
                    {t.learnedCount} of {t.totalCount} learned
                  </span>
                </div>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
