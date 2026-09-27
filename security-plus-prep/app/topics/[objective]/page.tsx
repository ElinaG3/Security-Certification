import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getTopic } from '@/lib/topics';

export const dynamic = 'force-dynamic';

export default async function TopicDetailPage({ params }: { params: Promise<{ objective: string }> }) {
  const { objective } = await params;
  const user = await getCurrentUser();
  const topic = await getTopic(user.id, decodeURIComponent(objective));
  if (!topic) notFound();

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '40px 20px' }}>
      <p style={{ marginBottom: 16 }}>
        <Link href="/topics">&larr; All topics</Link>
      </p>
      <h1 style={{ marginBottom: 4 }}>{topic.label}</h1>
      <p style={{ color: '#666', marginBottom: 24 }}>{topic.domain}</p>

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
        <h2 style={{ fontSize: 16, marginBottom: 10 }}>Notes &amp; drawings</h2>
        <p style={{ color: '#666' }}>Coming with Recall mode.</p>
      </section>
    </main>
  );
}
