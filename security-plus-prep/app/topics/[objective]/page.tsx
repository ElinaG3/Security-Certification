import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getTopic } from '@/lib/topics';
import { getTopicNote } from '@/lib/topic-notes';
import { getCachedStudySheet } from '@/lib/topic-study-sheet';
import { listTopicImages } from '@/lib/topic-images';
import { sourceTextFromReading, computeSourceHash } from '@/lib/study-sheet-generation';
import { TopicNotes } from '@/components/topics/TopicNotes';
import { StudySheetView } from '@/components/topics/StudySheetView';
import { TopicImages } from '@/components/topics/TopicImages';
import { getActiveCertificationId } from '@/lib/active-certification';
import { BookOpenIcon, PlusIcon, BrainIcon, TargetIcon } from '@/components/icons';

export const dynamic = 'force-dynamic';

export default async function TopicDetailPage({ params }: { params: Promise<{ objective: string }> }) {
  const { objective } = await params;
  const user = await getCurrentUser();
  const decoded = decodeURIComponent(objective);
  const [topic, note, cachedSheet, certificationId, topicImages] = await Promise.all([
    getTopic(user.id, decoded),
    getTopicNote(decoded),
    getCachedStudySheet(decoded),
    getActiveCertificationId(),
    listTopicImages(decoded),
  ]);
  if (!topic) notFound();

  // A cheap hash comparison, not a re-fetch — decides whether the client
  // needs to spend the one AI call, or can just render the cached sheet.
  const currentSourceHash = topic.reading.length > 0 ? computeSourceHash(sourceTextFromReading(topic.reading)) : null;
  const needsGeneration = topic.reading.length > 0 && (!cachedSheet || cachedSheet.sourceHash !== currentSourceHash);

  const pct = topic.totalActiveCount > 0 ? Math.round((topic.learnedCount / topic.totalActiveCount) * 100) : 0;
  const firstPdfRef = topic.pdfReferences[0];

  return (
    <div>
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

      <div className="topic-layout">
        {/* Read */}
        <div className="card" style={{ padding: 24 }}>
          <h2 style={{ fontSize: 16, marginBottom: 14 }}>Read</h2>

          <StudySheetView
            objective={decoded}
            reading={topic.reading}
            initialSheet={cachedSheet?.content ?? null}
            needsGeneration={needsGeneration}
          />

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
            <TopicImages objective={decoded} certificationId={certificationId} initialImages={topicImages} />
          </div>
        </div>

        {/* Progress + actions — compact row-of-3 on phone (CSS `order`
            puts this card visually first there), full sticky sidebar
            with full labels from 1024px up. */}
        <div className="card topic-aside" style={{ padding: 20 }}>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
            Your progress on this topic: <strong style={{ color: 'var(--text)' }}>{topic.learnedCount} of {topic.totalActiveCount} cards learned</strong>
          </p>
          <div className="bar-track" style={{ marginBottom: 20 }}>
            <div className="bar-fill" style={{ width: `${pct}%` }} />
          </div>

          <div className="topic-action-row">
            <Link
              href={`/create?domain=${encodeURIComponent(topic.domain)}&objective=${encodeURIComponent(decoded)}`}
              className="btn btn-primary topic-action-btn"
            >
              <PlusIcon size={16} />
              <span className="topic-action-label-short">Create</span>
              <span className="topic-action-label-full">Create a card from this</span>
            </Link>
            <Link href={`/recall/${encodeURIComponent(decoded)}`} className="btn topic-action-btn">
              <BrainIcon size={16} />
              <span className="topic-action-label-short">Recall</span>
              <span className="topic-action-label-full">Free recall on this topic</span>
            </Link>
            <Link href={`/study?objective=${encodeURIComponent(decoded)}`} className="btn topic-action-btn">
              <TargetIcon size={16} />
              <span className="topic-action-label-short">Practice</span>
              <span className="topic-action-label-full">Practice this topic&apos;s cards</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
