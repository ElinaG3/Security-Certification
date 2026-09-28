import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { getDueQueue, getPbqWarmupQueue } from '@/lib/queue';
import { TargetIcon, ClockIcon } from '@/components/icons';

export const dynamic = 'force-dynamic';

const gridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(240px, 1fr))', gap: 16, marginBottom: 16 };

export default async function PracticeHubPage() {
  const user = await getCurrentUser();
  const [dueQueue, warmupQueue] = await Promise.all([
    getDueQueue({ userId: user.id, limit: 1000 }),
    getPbqWarmupQueue({ userId: user.id, limit: 1000 }),
  ]);

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ fontSize: 26, marginBottom: 6 }}>Practicing</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>Exam questions to prepare for the test.</p>

      <div style={gridStyle}>
        <Link
          href="/study"
          className="card"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            padding: 24,
            background: 'var(--accent)',
            color: '#fff',
            borderColor: 'var(--accent)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'rgba(255,255,255,0.18)',
              }}
            >
              <TargetIcon size={22} />
            </span>
            <span className="pill pill-accent">{dueQueue.length} due today</span>
          </div>
          <div>
            <p style={{ fontFamily: 'var(--font-heading)', fontSize: 20, marginBottom: 6 }}>Daily questions</p>
            <p style={{ fontSize: 13, opacity: 0.85 }}>Your FSRS due queue — cards scheduled for today.</p>
          </div>
        </Link>

        <Link href="/study?mode=warmup" className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'var(--accent-tint)',
                color: 'var(--accent)',
              }}
            >
              <ClockIcon size={22} />
            </span>
            <span className="pill pill-neutral">{warmupQueue.length} available</span>
          </div>
          <div>
            <p style={{ fontFamily: 'var(--font-heading)', fontSize: 20, marginBottom: 6 }}>PBQ warm-up</p>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Performance-based questions under a timer.</p>
          </div>
        </Link>
      </div>

      <div className="placeholder-dashed" style={{ padding: 24, textAlign: 'center' }}>
        <p style={{ fontWeight: 600, marginBottom: 4 }}>Full practice exam</p>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>90 questions, 90 minutes — Coming later</p>
      </div>
    </div>
  );
}
