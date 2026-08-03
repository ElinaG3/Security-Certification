import Link from 'next/link';
import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { cards } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth';
import { getDueQueue, DEFAULT_SESSION_SIZE } from '@/lib/queue';
import { toPublicContent, type PublicCard } from '@/lib/question-public';
import type { MultipleChoiceContent, MultipleSelectContent } from '@/db/question-types';
import { StudySession } from '@/components/StudySession';

export default async function StudyPage({
  searchParams,
}: {
  searchParams: Promise<{ domain?: string }>;
}) {
  const { domain } = await searchParams;
  const user = await getCurrentUser();
  const db = getDb();

  const [domainRows, dueCards] = await Promise.all([
    db.selectDistinct({ domain: cards.domain }).from(cards).where(eq(cards.userId, user.id)),
    getDueQueue({ userId: user.id, domain, limit: DEFAULT_SESSION_SIZE }),
  ]);

  // The Server Component boundary: only sanitized content ever leaves this
  // function. cardUpdate/content.correct/explanation stay server-side.
  const publicCards: PublicCard[] = dueCards
    .filter((c): c is typeof c & { type: 'multiple_choice' | 'multiple_select' } =>
      c.type === 'multiple_choice' || c.type === 'multiple_select'
    )
    .map((c) => ({
      id: c.id,
      domain: c.domain,
      topic: c.topic,
      type: c.type,
      content: toPublicContent(c.type, c.content as MultipleChoiceContent | MultipleSelectContent),
    }));

  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '40px 20px' }}>
      <h1>Study</h1>

      <nav style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '12px 0 24px' }}>
        <Link href="/study" style={{ fontWeight: domain ? 400 : 700 }}>
          All domains
        </Link>
        {domainRows.map((d) => (
          <Link
            key={d.domain}
            href={`/study?domain=${encodeURIComponent(d.domain)}`}
            style={{ fontWeight: domain === d.domain ? 700 : 400 }}
          >
            {d.domain}
          </Link>
        ))}
      </nav>

      {publicCards.length === 0 ? (
        <p>No cards due right now{domain ? ` in ${domain}` : ''}.</p>
      ) : (
        <StudySession initialCards={publicCards} />
      )}
    </main>
  );
}
