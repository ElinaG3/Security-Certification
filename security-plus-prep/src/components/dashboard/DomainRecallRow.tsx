export interface DomainRecallData {
  domain: string;
  accuracy: number | null; // null = no graded recall attempts in this domain yet
  attemptCount: number;
}

// No coverage bar here — unlike cards, there's no fixed "total possible"
// denominator for free-recall attempts, so this stays a simple name +
// number row rather than borrowing DomainProgressRow's bar.
export function DomainRecallRow({ data }: { data: DomainRecallData }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, padding: '10px 0', borderBottom: '1px solid #f0f0f0', flexWrap: 'wrap' }}>
      <span style={{ fontWeight: 600, fontSize: 14 }}>{data.domain}</span>
      <span style={{ fontSize: 13, color: data.accuracy !== null ? '#333' : '#999' }}>
        {data.accuracy !== null
          ? `${Math.round(data.accuracy * 100)}% accuracy · ${data.attemptCount} attempt${data.attemptCount === 1 ? '' : 's'}`
          : 'No attempts yet'}
      </span>
    </div>
  );
}
