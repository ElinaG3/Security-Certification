import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { getStudyStats, getLearningProgress } from '@/lib/dashboard';
import { getActiveCertification, listCertifications } from '@/lib/active-certification';
import { CertificationSwitcher } from '@/components/CertificationSwitcher';
import { DomainLearnedRow } from '@/components/dashboard/DomainLearnedRow';

// Live progress data on every load — no searchParams/cookies to otherwise
// signal dynamic rendering, so without this Next would statically
// prerender a stale snapshot at build time (same class of bug fixed on
// /review and /topics).
export const dynamic = 'force-dynamic';

const bigButtonGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
  gap: 16,
  marginBottom: 40,
};

function BigButton({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <Link
      href={href}
      style={{
        display: 'block',
        padding: '24px 20px',
        border: '1px solid #ddd',
        borderRadius: 10,
        background: '#fff',
      }}
    >
      <p style={{ fontWeight: 700, fontSize: 20, marginBottom: 6 }}>{title}</p>
      <p style={{ fontSize: 14, color: '#666', margin: 0 }}>{description}</p>
    </Link>
  );
}

export default async function HomePage() {
  const user = await getCurrentUser();
  const [stats, progress, activeCert, allCerts] = await Promise.all([
    getStudyStats(user.id),
    getLearningProgress(user.id),
    getActiveCertification(),
    listCertifications(),
  ]);

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '40px 20px' }}>
      {/* --- Header: cert identity + switcher --- */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ marginBottom: 4, fontSize: 24 }}>{activeCert.name}</h1>
          <p style={{ color: '#666', margin: 0 }}>{activeCert.examCode}</p>
        </div>
        <CertificationSwitcher certifications={allCerts} activeCertificationId={activeCert.id} />
      </div>
      <p style={{ fontSize: 13, color: '#999', marginBottom: 32, minHeight: 16 }}>
        {stats.currentStreak > 0 && `🔥 ${stats.currentStreak}-day streak`}
      </p>

      {/* --- Two big buttons --- */}
      <div style={bigButtonGridStyle}>
        <BigButton href="/learn" title="Learning" description="Read, take notes, and learn new topics" />
        <BigButton href="/practice" title="Practicing" description="Exam questions to prepare for the test" />
      </div>

      {/* --- Progress --- */}
      <section>
        <h2 style={{ fontSize: 18, marginBottom: 4 }}>Progress</h2>
        <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
          A card counts as learned when you&apos;d likely remember it today.
        </p>
        <div>
          {progress.map((d) => (
            <DomainLearnedRow key={d.domain} data={d} />
          ))}
        </div>
      </section>
    </main>
  );
}
