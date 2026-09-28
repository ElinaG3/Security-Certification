import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getTopic } from '@/lib/topics';
import { RecallView } from '@/components/recall/RecallView';

export const dynamic = 'force-dynamic';

export default async function RecallTopicPage({ params }: { params: Promise<{ objective: string }> }) {
  const { objective } = await params;
  const user = await getCurrentUser();
  const decoded = decodeURIComponent(objective);
  const topic = await getTopic(user.id, decoded);
  if (!topic) notFound();

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '40px 20px' }}>
      <p style={{ marginBottom: 16 }}>
        <Link href={`/topics/${encodeURIComponent(decoded)}`}>&larr; {topic.label}</Link>
      </p>
      <h1 style={{ marginBottom: 4 }}>Recall — {topic.label}</h1>
      <p style={{ color: '#666', marginBottom: 24 }}>{topic.domain}</p>

      <RecallView objective={decoded} topic={topic.label} domain={topic.domain} />
    </main>
  );
}
