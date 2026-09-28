import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getTopic } from '@/lib/topics';
import { listRecallAttempts } from '../../recall/actions';

export const dynamic = 'force-dynamic';

export default async function TopicDetailPage({ params }: { params: Promise<{ objective: string }> }) {
  const { objective } = await params;
  const user = await getCurrentUser();
  const decoded = decodeURIComponent(objective);
  const [topic, recallAttempts] = await Promise.all([getTopic(user.id, decoded), listRecallAttempts(decoded)]);
  if (!topic) notFound();

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '40px 20px' }}>
      <p style={{ marginBottom: 16 }}>
        <Link href="/topics">&larr; All topics</Link>
      </p>
      <h1 style={{ marginBottom: 4 }}>{topic.label}</h1>
      <p style={{ color: '#666', marginBottom: 24 }}>{topic.domain}</p>

      {topic.pdfReferences.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 16, marginBottom: 10 }}>Read in Library</h2>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {topic.pdfReferences.map((ref, i) => (
              <li key={i} style={{ marginBottom: 6 }}>
                <Link
                  href={`/library/${ref.pdfId}?page=${ref.startPage}`}
                  style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', border: '1px solid #eee', borderRadius: 6, gap: 8, flexWrap: 'wrap' }}
                >
                  <span>
                    {ref.filename}
                    {ref.sectionTitle && ` — ${ref.sectionTitle}`}
                  </span>
                  <span style={{ color: '#999', fontSize: 13 }}>
                    page {ref.startPage}
                    {ref.endPage !== ref.startPage ? `–${ref.endPage}` : ''}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 16, marginBottom: 10 }}>Cards ({topic.cards.length})</h2>
        {topic.cards.length === 0 ? (
          <p style={{ color: '#666' }}>No cards tagged to this objective yet.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {topic.cards.map((c) => (
              <li
                key={c.id}
                style={{
                  border: '1px solid #eee',
                  borderRadius: 6,
                  padding: '10px 12px',
                  marginBottom: 8,
                  background: c.flagged ? '#fdf4f4' : c.status === 'pending' ? '#fffdf4' : '#fff',
                }}
              >
                <p style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>
                  {c.topic}
                  {c.type === 'multiple_select' && ' · multi-select'}
                  {c.status === 'pending' && ' · pending review'}
                  {c.flagged && ' · 🚩 flagged'}
                </p>
                <p style={{ margin: 0 }}>{c.question}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 style={{ fontSize: 16, marginBottom: 10 }}>Recall attempts ({recallAttempts.length})</h2>
        <p style={{ marginBottom: 12 }}>
          <Link href={`/recall/${encodeURIComponent(decoded)}`}>Start a recall attempt &rarr;</Link>
        </p>
        {recallAttempts.length === 0 ? (
          <p style={{ color: '#666' }}>No attempts yet.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {recallAttempts.map((a) => (
              <li key={a.id} style={{ border: '1px solid #eee', borderRadius: 6, padding: '10px 12px', marginBottom: 8 }}>
                <p style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>
                  {new Date(a.createdAt).toLocaleString()} · {a.inputMode}
                  {a.score !== null && ` · ${Math.round(a.score * 100)}%`}
                </p>
                {a.gapReport && (
                  <p style={{ margin: 0, fontSize: 13 }}>
                    {a.gapReport.correct.length} recalled, {a.gapReport.missed.length} missed
                    {a.gapReport.errors.length > 0 && `, ${a.gapReport.errors.length} error(s)`}
                  </p>
                )}
                {a.drawingUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.drawingUrl} alt="drawing" style={{ maxWidth: 160, marginTop: 6, borderRadius: 4, border: '1px solid #ddd' }} />
                )}
                {a.drawingComments && <p style={{ fontSize: 12, color: '#666', marginTop: 4 }}>{a.drawingComments}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
