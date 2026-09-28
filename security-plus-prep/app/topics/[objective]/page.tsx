import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getTopic } from '@/lib/topics';
import { getTopicNote } from '@/lib/topic-notes';
import { TopicNotes } from '@/components/topics/TopicNotes';
import { BookOpenIcon, PlusIcon, BrainIcon, TargetIcon } from '@/components/icons';

export const dynamic = 'force-dynamic';

export default async function TopicDetailPage({ params }: { params: Promise<{ objective: string }> }) {
  const { objective } = await params;
  const user = await getCurrentUser();
  const decoded = decodeURIComponent(objective);
  const [topic, note] = await Promise.all([getTopic(user.id, decoded), getTopicNote(decoded)]);
  if (!topic) notFound();

  const pct = topic.totalActiveCount > 0 ? Math.round((topic.learnedCount / topic.totalActiveCount) * 100) : 0;
  const firstPdfRef = topic.pdfReferences[0];

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <nav className="breadcrumb" style={{ marginBottom: 16 }}>
        <Link href="/learn">Learning</Link>
        <span>/</span>
        <Link href="/topics">Topics</Link>
        <span>/</span>
        <span style={{ color: 'var(--text)', fontWeight: 600 }}>{topic.objective}</span>
      </nav>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        <h1 style={{ fontSize: 26 }}>{topic.label}</h1>
        <span className="pill pill-tint">{topic.domain}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px', gap: 24, alignItems: 'start' }}>
        {/* Left: Read */}
        <div className="card" style={{ padding: 24 }}>
          <h2 style={{ fontSize: 16, marginBottom: 14 }}>Read</h2>

          {topic.reading.length === 0 ? (
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20 }}>
              No source material ingested for this objective yet — upload a PDF in the Library.
            </p>
          ) : (
            <div style={{ marginBottom: 20 }}>
              {topic.reading.map((section, i) => (
                <div key={i} style={{ marginBottom: 16 }}>
                  {section.sectionTitle && (
                    <p style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>{section.sectionTitle}</p>
                  )}
                  <p style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>{section.content}</p>
                </div>
              ))}
            </div>
          )}

          {firstPdfRef && (
            <Link
              href={`/library/${firstPdfRef.pdfId}?page=${firstPdfRef.startPage}`}
              className="btn"
              style={{ marginBottom: 24 }}
            >
              <BookOpenIcon size={16} /> Open in Library
            </Link>
          )}

          <div style={{ paddingTop: 20, borderTop: '1px solid var(--card-border)' }}>
            <TopicNotes objective={decoded} initialContent={note} />
          </div>
        </div>

        {/* Right: progress + actions */}
        <div className="card" style={{ padding: 20, position: 'sticky', top: 'calc(var(--topbar-height) + 16px)' }}>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
            Your progress on this topic: <strong style={{ color: 'var(--text)' }}>{topic.learnedCount} of {topic.totalActiveCount} cards learned</strong>
          </p>
          <div className="bar-track" style={{ marginBottom: 20 }}>
            <div className="bar-fill" style={{ width: `${pct}%` }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Link
              href={`/create?domain=${encodeURIComponent(topic.domain)}&objective=${encodeURIComponent(decoded)}`}
              className="btn btn-primary"
              style={{ width: '100%' }}
            >
              <PlusIcon size={16} /> Create a card from this
            </Link>
            <Link href={`/recall/${encodeURIComponent(decoded)}`} className="btn" style={{ width: '100%' }}>
              <BrainIcon size={16} /> Free recall on this topic
            </Link>
            <Link href={`/study?objective=${encodeURIComponent(decoded)}`} className="btn" style={{ width: '100%' }}>
              <TargetIcon size={16} /> Practice this topic&apos;s cards
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
