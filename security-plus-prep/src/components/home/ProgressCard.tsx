import Link from 'next/link';
import type { DomainLearningProgress } from '@/lib/dashboard';
import { tileLevel } from '@/lib/dashboard';
import { shortDomainName } from '@/lib/domain-labels';

const LEGEND: { level: 0 | 1 | 2 | 3 | 4; label: string }[] = [
  { level: 0, label: 'Not started' },
  { level: 1, label: 'Started' },
  { level: 2, label: 'Learning' },
  { level: 3, label: 'Good' },
  { level: 4, label: 'Strong' },
];

function DomainColumn({ domain }: { domain: DomainLearningProgress }) {
  const pct = domain.totalCount > 0 ? Math.round((domain.learnedCount / domain.totalCount) * 100) : 0;

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div className="domain-label" style={{ marginBottom: 4 }}>
        <span style={{ fontWeight: 600, fontSize: 13, cursor: 'default' }}>{shortDomainName(domain.domain)}</span>
        <span className="domain-full-name">{domain.domain}</span>
      </div>
      <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>{domain.targetWeight}% of exam</p>
      <div className="bar-track" style={{ marginBottom: 10 }}>
        <div className="bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
        {domain.topics.map((t) => {
          const level = tileLevel(t.learnedCount, t.totalCount);
          return (
            <Link key={t.objective} href={`/topics/${encodeURIComponent(t.objective)}`} className={`tile tile-${level}`} title={t.label}>
              {t.objective}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function ProgressCard({ domains }: { domains: DomainLearningProgress[] }) {
  const totalLearned = domains.reduce((sum, d) => sum + d.learnedCount, 0);
  const totalCards = domains.reduce((sum, d) => sum + d.totalCount, 0);
  const overallPct = totalCards > 0 ? Math.round((totalLearned / totalCards) * 100) : 0;

  return (
    <div className="card" style={{ padding: '18px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        <h2 style={{ fontSize: 18 }}>Your progress</h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>
          {totalLearned} of {totalCards} cards learned · {overallPct}%
        </p>
      </div>

      <div style={{ display: 'flex', gap: 20, marginBottom: 14 }}>
        {domains.map((d) => (
          <DomainColumn key={d.domain} domain={d} />
        ))}
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', paddingTop: 12, borderTop: '1px solid var(--card-border)' }}>
        {LEGEND.map((l) => (
          <div key={l.level} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 12, height: 12, borderRadius: 4, background: `var(--tile-${l.level})`, display: 'inline-block' }} />
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
