import Link from 'next/link';
import { getCountdownInfo, formatExamDate } from '@/lib/countdown';

export function CountdownCard({ examDate }: { examDate: Date | null }) {
  if (!examDate) {
    return (
      <div className="card" style={{ padding: '20px 24px', marginBottom: 16 }}>
        <p style={{ fontFamily: 'var(--font-heading)', fontSize: 22, marginBottom: 6 }}>No exam date set</p>
        <Link href="/profile" className="btn btn-primary" style={{ marginTop: 4 }}>
          Set your exam date
        </Link>
      </div>
    );
  }

  const { daysUntilExam, weeks } = getCountdownInfo(examDate);
  const dayLabel = daysUntilExam < 0 ? 'Exam date has passed' : daysUntilExam === 0 ? 'Today' : `${daysUntilExam} day${daysUntilExam === 1 ? '' : 's'}`;

  return (
    <div className="card" style={{ padding: '18px 24px', marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <p style={{ fontFamily: 'var(--font-heading)', fontSize: 30, lineHeight: 1.1 }}>
          {dayLabel}
          {daysUntilExam >= 0 && <span style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 15, color: 'var(--text-secondary)', marginLeft: 8 }}>until your exam</span>}
        </p>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>{formatExamDate(examDate)}</p>
      </div>

      <div style={{ display: 'flex', gap: 4 }}>
        {weeks.map((w, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center' }}>
            <div
              style={{
                height: 8,
                borderRadius: 4,
                background: w.current ? 'var(--accent)' : 'var(--tile-0)',
                marginBottom: 4,
              }}
            />
            <span style={{ fontSize: 10, color: w.current ? 'var(--accent)' : 'var(--text-secondary)', fontWeight: w.current ? 600 : 500 }}>
              {w.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
