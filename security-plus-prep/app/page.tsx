import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { getStudyStats, getDomainRetention, getDomainRecallAccuracy, getTopicProgress, WEAK_THRESHOLD } from '@/lib/dashboard';
import { getActiveDomains, getActiveCertification, listCertifications } from '@/lib/active-certification';
import { CertificationSwitcher } from '@/components/CertificationSwitcher';
import { DomainProgressRow } from '@/components/dashboard/DomainProgressRow';
import { DomainRecallRow } from '@/components/dashboard/DomainRecallRow';

// Live progress data on every load — no searchParams/cookies to otherwise
// signal dynamic rendering, so without this Next would statically
// prerender a stale snapshot at build time (same class of bug fixed on
// /review and /topics).
export const dynamic = 'force-dynamic';

const RETENTION_COLOR = '#3b6fa6';

const sectionStyle: React.CSSProperties = { marginBottom: 40 };
const sectionHeadingStyle: React.CSSProperties = { fontSize: 18, marginBottom: 4 };
const tileGridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 };

function FeatureTile({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <Link
      href={href}
      style={{
        display: 'block',
        padding: '14px 16px',
        border: '1px solid #ddd',
        borderRadius: 8,
        background: '#fff',
      }}
    >
      <p style={{ fontWeight: 700, marginBottom: 4 }}>{title}</p>
      <p style={{ fontSize: 12, color: '#666', margin: 0 }}>{description}</p>
    </Link>
  );
}

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

  const weakTopics = topics.filter((t) => t.isWeak).sort((a, b) => (a.retention ?? 1) - (b.retention ?? 1));
  const totalRecallAttempts = recallAccuracy.reduce((sum, r) => sum + r.attemptCount, 0);

  const byDomain = new Map<string, typeof topics>();
  for (const t of topics) {
    if (!byDomain.has(t.domain)) byDomain.set(t.domain, []);
    byDomain.get(t.domain)!.push(t);
  }

  const studiedPct = stats.totalActiveCards > 0 ? Math.round((stats.cardsStudied / stats.totalActiveCards) * 100) : 0;

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '40px 20px' }}>
      {/* --- Header: always-visible cert identity + switcher --- */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>{activeCert.name}</h1>
          <p style={{ color: '#666', margin: 0 }}>{activeCert.examCode}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <CertificationSwitcher certifications={allCerts} activeCertificationId={activeCert.id} />
          <Link href="/certifications/new" style={navLink}>
            + Add certification
          </Link>
        </div>
      </div>

      {/* --- Section 1: Practice for the exam --- */}
      <section style={sectionStyle}>
        <h2 style={sectionHeadingStyle}>Practice for the exam</h2>
        <p style={{ fontSize: 13, color: '#666', marginBottom: 12 }}>Repetition — staying sharp on what you already know.</p>
        <div style={tileGridStyle}>
          <FeatureTile href="/study" title="Daily study" description="Your FSRS due queue — cards scheduled for today." />
          <FeatureTile href="/study?mode=warmup" title="PBQ warm-up" description="Drag/match and log-analysis performance-based questions." />
        </div>
      </section>

      {/* --- Section 2: Learning --- */}
      <section style={sectionStyle}>
        <h2 style={sectionHeadingStyle}>Learning</h2>
        <p style={{ fontSize: 13, color: '#666', marginBottom: 12 }}>Everything about learning new material.</p>
        <div style={{ ...tileGridStyle, marginBottom: 12 }}>
          <FeatureTile href="/learning" title="Guided Learning Session" description="A structured 20-70 min session: recall, typed cards, hands-on practice." />
          <FeatureTile href="/library" title="Library" description="Read your source PDFs in-app, linked to topics." />
          <FeatureTile href="/topics" title="Topics" description="Browse by SY0-701 objective — cards, notes, and recall history." />
          <FeatureTile href="/recall" title="Free recall" description="Write or draw everything you know, graded against source material." />
        </div>
        <nav style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link href="/create" style={navLink}>
            Create card
          </Link>
          <Link href="/review" style={navLink}>
            Review cards
          </Link>
          <Link href="/search" style={navLink}>
            Search
          </Link>
        </nav>
      </section>

      {/* --- Section 3: Progress --- */}
      <section>
        <h2 style={sectionHeadingStyle}>Progress</h2>

        <p style={{ fontSize: 15, marginBottom: 24, lineHeight: 1.5 }}>
          You&apos;ve studied <strong>{stats.cardsStudied} of {stats.totalActiveCards}</strong> cards ({studiedPct}%).
          {stats.overallRetention !== null ? (
            <>
              {' '}
              Of those, you&apos;d likely remember about <strong>{Math.round(stats.overallRetention * 100)}%</strong> today.
            </>
          ) : (
            ' Study a few cards to get a retention estimate.'
          )}
        </p>

        <div style={{ display: 'flex', gap: 12, marginBottom: 28, flexWrap: 'wrap' }}>
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

        <div style={{ marginBottom: 28 }}>
          <h3 style={{ fontSize: 14, marginBottom: 4 }}>Cards, by domain</h3>
          <p style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>
            Coverage (how much you&apos;ve studied) and retention (how well you remember it) are different questions — shown
            separately, never merged into one number.
          </p>
          <div>
            {retention.map((r) => (
              <DomainProgressRow
                key={r.domain}
                barColor={RETENTION_COLOR}
                data={{ domain: r.domain, studiedCount: r.reviewedCount, totalCount: r.totalCount, retention: r.retention, targetWeight: r.targetWeight }}
              />
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 28 }}>
          <h3 style={{ fontSize: 14, marginBottom: 4 }}>Free-recall accuracy, by domain</h3>
          <p style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>
            A separate signal from card retention above — recognizing an answer (multiple choice) and producing one from
            memory (free recall) are different skills.
          </p>
          {totalRecallAttempts === 0 ? (
            <p style={{ fontSize: 13, color: '#666', padding: '10px 0' }}>
              No free-recall attempts yet —{' '}
              <Link href="/recall" style={{ fontWeight: 600 }}>
                try one from the Learning section
              </Link>
              .
            </p>
          ) : (
            <div>
              {recallAccuracy.map((r) => (
                <DomainRecallRow key={r.domain} data={r} />
              ))}
            </div>
          )}
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
                  <Link href={`/topics/${encodeURIComponent(t.objective)}`} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', border: '1px solid #f0d9d9', background: '#fdf7f7', borderRadius: 6, flexWrap: 'wrap', gap: 4 }}>
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

      {/* --- Topic grid (kept — objective-level browse, distinct from the domain-level progress rows above) --- */}
      <section style={{ marginTop: 40 }}>
        <h2 style={sectionHeadingStyle}>Topics</h2>
        {topics.length === 0 ? (
          <p style={{ color: '#666' }}>No topics yet — cards need an objective assigned before they show up here.</p>
        ) : (
          activeDomains.map((domain) => {
            const domainTopics = byDomain.get(domain) ?? [];
            if (domainTopics.length === 0) return null;
            return (
              <div key={domain} style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 14, color: '#444', marginBottom: 8 }}>{domain}</h3>
                <div style={tileGridStyle}>
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
