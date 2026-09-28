// Deliberately plain CSS, not Recharts — the old chart's fixed-width Y-axis
// tick area truncated long domain names ("Security Program Management and
// Oversight"), and coverage/retention/weight need to read as three
// distinct, fully-labeled facts side by side, not compressed into one bar.
// No chart library handles "full text label + two independent bars + a
// plain-text number" as a single row better than a few flex divs.

export interface DomainProgressData {
  domain: string;
  studiedCount: number;
  totalCount: number;
  retention: number | null; // null = nothing in this domain has been reviewed yet
  targetWeight: number;
}

const trackStyle: React.CSSProperties = {
  height: 8,
  borderRadius: 4,
  background: '#eee',
  overflow: 'hidden',
  flex: 1,
};

export function DomainProgressRow({ data, barColor }: { data: DomainProgressData; barColor: string }) {
  const coveragePct = data.totalCount > 0 ? (data.studiedCount / data.totalCount) * 100 : 0;

  return (
    <div style={{ padding: '12px 0', borderBottom: '1px solid #f0f0f0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 600, fontSize: 14, whiteSpace: 'normal', wordBreak: 'break-word' }}>{data.domain}</span>
        <span style={{ fontSize: 12, color: '#999', whiteSpace: 'nowrap' }}>{data.targetWeight}% of exam</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <div style={trackStyle}>
          <div style={{ height: '100%', width: `${coveragePct}%`, background: barColor, borderRadius: 4 }} />
        </div>
        <span style={{ fontSize: 12, color: '#666', whiteSpace: 'nowrap', minWidth: 130, textAlign: 'right' }}>
          {data.studiedCount} of {data.totalCount} cards studied
        </span>
      </div>

      <p style={{ fontSize: 12, color: '#666', margin: 0 }}>
        {data.retention !== null ? (
          <>
            <strong style={{ color: '#333' }}>{Math.round(data.retention * 100)}% retention</strong> — how likely you are to
            remember the {data.studiedCount} card{data.studiedCount === 1 ? '' : 's'} you&apos;ve studied here, right now
          </>
        ) : (
          'Not studied yet — no retention estimate until you review a card here'
        )}
      </p>
    </div>
  );
}
