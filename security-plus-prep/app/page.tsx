import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { getStudyStats, getDomainRetention, getDomainRecallAccuracy, getTopicProgress, WEAK_THRESHOLD } from '@/lib/dashboard';
import { getActiveDomains, getActiveCertification, listCertifications } from '@/lib/active-certification';
import { DomainBarChart, type DomainBarDatum } from '@/components/dashboard/DomainBarChart';
import { CertificationSwitcher } from '@/components/CertificationSwitcher';

// Live progress data on every load — no searchParams/cookies to otherwise
// signal dynamic rendering, so without this Next would statically
// prerender a stale snapshot at build time (same class of bug fixed on
// /review and /topics).
export const dynamic = 'force-dynamic';

const RETENTION_COLOR = '#3b6fa6';
const RECALL_COLOR = '#7b5ea7';

const statTileStyle: React.CSSProperties = {
  flex: '1 1 120px',
  border: '1px solid #eee',
  borderRadius: 8,
  padding: '14px 16px',
};

export default async function HomePage() {
  const user = await getCurrentUser();
  const [stats, retention, recallAccuracy, topics, activeDomains, activeCert, allCerts] = await Promise.all([
    getStudyStats(user.id),
    getDomainRetention(user.id),
    getDomainRecallAccuracy(user.id),
    getTopicProgress(user.id),
    getActiveDomains(),
    getActiveCertification(),
    listCertifications(),
  ]);

  const retentionData: DomainBarDatum[] = retention.map((r) => ({
    domain: r.domain,
    value: r.retention,
    sublabel: r.reviewedCount > 0 ? `${r.reviewedCount}/${r.totalCount} reviewed · target ${r.targetWeight}%` : `target ${r.targetWeight}%`,
  }));

  const recallData: DomainBarDatum[] = recallAccuracy.map((r) => ({
    domain: r.domain,
    value: r.accuracy,
    sublabel: r.attemptCount > 0 ? `${r.attemptCount} attempt${r.attemptCount === 1 ? '' : 's'}` : undefined,
  }));

  const weakTopics = topics.filter((t) => t.isWeak).sort((a, b) => (a.retention ?? 1) - (b.retention ?? 1));

  const byDomain = new Map<string, typeof topics>();
  for (const t of topics) {
    if (!byDomain.has(t.domain)) byDomain.set(t.domain, []);
    byDomain.get(t.domain)!.push(t);
  }

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '40px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>{activeCert.name} Study</h1>
          <p style={{ color: '#666', margin: 0 }}>{activeCert.examCode}</p>
        </div>
        <CertificationSwitcher certifications={allCerts} activeCertificationId={activeCert.id} />
      </div>

      <nav style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 32 }}>
        <Link href="/study" style={navLink}>
          Study
        </Link>
        <Link href="/recall" style={navLink}>
          Recall
        </Link>
        <Link href="/topics" style={navLink}>
          Topics
        </Link>
        <Link href="/search" style={navLink}>
          Search
        </Link>
        <Link href="/review" style={navLink}>
          Review
        </Link>
        <Link href="/create" style={navLink}>
          Create
        </Link>
      </nav>

      {/* --- Progress overview --- */}
      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>Progress</h2>

        <div style={{ display: 'flex', gap: 12, marginBottom: 28, flexWrap: 'wrap' }}>
          <div style={statTileStyle}>
            <p style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>Cards studied</p>
            <p style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
              {stats.cardsStudied}
              <span style={{ fontSize: 14, color: '#999', fontWeight: 400 }}> / {stats.totalActiveCards}</span>
            </p>
          </div>
          <div style={statTileStyle}>
            <p style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>Current streak</p>
            <p style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
              {stats.currentStreak} {stats.currentStreak === 1 ? 'day' : 'days'}
            </p>
          </div>
          <div style={statTileStyle}>
            <p style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>Study days (total)</p>
            <p style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>{stats.studyDays}</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 24 }}>
          <div style={{ flex: '1 1 380px', minWidth: 320 }}>
            <h3 style={{ fontSize: 14, marginBottom: 8 }}>Card retention by domain</h3>
            <p style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>Recognition (FSRS) — target % is exam weighting, shown for reference, not blended in.</p>
            <DomainBarChart data={retentionData} color={RETENTION_COLOR} />
          </div>
          <div style={{ flex: '1 1 380px', minWidth: 320 }}>
            <h3 style={{ fontSize: 14, marginBottom: 8 }}>Recall accuracy by domain</h3>
            <p style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>Production (free recall) — a separate signal from retention above.</p>
            <DomainBarChart data={recallData} color={RECALL_COLOR} />
          </div>
        </div>

        <div>
          <h3 style={{ fontSize: 14, marginBottom: 8 }}>
            Weak topics ({weakTopics.length}) — below {Math.round(WEAK_THRESHOLD * 100)}% retention or recall accuracy
          </h3>
          {weakTopics.length === 0 ? (
            <p style={{ color: '#666', fontSize: 13 }}>
              None yet — either nothing has dropped below {Math.round(WEAK_THRESHOLD * 100)}%, or there isn&apos;t enough review/recall history to tell.
            </p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {weakTopics.map((t) => (
                <li key={t.objective} style={{ marginBottom: 6 }}>
                  <Link href={`/topics/${encodeURIComponent(t.objective)}`} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', border: '1px solid #f0d9d9', background: '#fdf7f7', borderRadius: 6 }}>
                    <span>{t.label}</span>
                    <span style={{ color: '#999', fontSize: 13 }}>
                      {t.retention !== null && `retention ${Math.round(t.retention * 100)}%`}
                      {t.retention !== null && t.recallAccuracy !== null && ' · '}
                      {t.recallAccuracy !== null && `recall ${Math.round(t.recallAccuracy * 100)}%`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* --- Topic grid --- */}
      <section>
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>Topics</h2>
        {topics.length === 0 ? (
          <p style={{ color: '#666' }}>No topics yet — cards need an objective assigned before they show up here.</p>
        ) : (
          activeDomains.map((domain) => {
            const domainTopics = byDomain.get(domain) ?? [];
            if (domainTopics.length === 0) return null;
            return (
              <div key={domain} style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 14, color: '#444', marginBottom: 8 }}>{domain}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                  {domainTopics.map((t) => (
                    <Link
                      key={t.objective}
                      href={`/topics/${encodeURIComponent(t.objective)}`}
                      style={{
                        display: 'block',
                        padding: '10px 12px',
                        border: '1px solid #eee',
                        borderRadius: 8,
                        background: t.isWeak ? '#fdf7f7' : '#fff',
                      }}
                    >
                      <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{t.label}</p>
                      <p style={{ fontSize: 12, color: '#999', margin: 0 }}>
                        {t.cardCount} card{t.cardCount === 1 ? '' : 's'}
                        {t.flaggedCount > 0 && ` · 🚩${t.flaggedCount}`}
                      </p>
                      <p style={{ fontSize: 12, color: '#999', margin: '2px 0 0' }}>
                        {t.retention !== null ? `${Math.round(t.retention * 100)}% retention` : 'not yet studied'}
                        {t.recallAttemptCount > 0 && ' · ✓ recall attempted'}
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </section>
    </main>
  );
}

const navLink: React.CSSProperties = {
  padding: '6px 12px',
  border: '1px solid #ccc',
  borderRadius: 6,
  fontWeight: 600,
};
