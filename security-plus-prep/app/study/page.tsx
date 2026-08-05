import Link from 'next/link';
import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { cards } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth';
import { getDueQueue, getPbqWarmupQueue, DEFAULT_SESSION_SIZE } from '@/lib/queue';
import { toPublicContent, type PublicCard } from '@/lib/question-public';
import type {
  MultipleChoiceContent,
  MultipleSelectContent,
  ArtifactPbqContent,
  RemediationSelectContent,
} from '@/db/question-types';
import { StudySession } from '@/components/StudySession';

const SUPPORTED_TYPES = [
  'multiple_choice',
  'multiple_select',
  'log_analysis',
  'config_table',
  'remediation_select',
] as const;

export default async function StudyPage({
  searchParams,
}: {
  searchParams: Promise<{ domain?: string; mode?: string }>;
}) {
  const { domain, mode } = await searchParams;
  const isWarmup = mode === 'warmup';
  const user = await getCurrentUser();
  const db = getDb();

  const [domainRows, queueCards] = await Promise.all([
    db.selectDistinct({ domain: cards.domain }).from(cards).where(eq(cards.userId, user.id)),
    isWarmup
      ? getPbqWarmupQueue({ userId: user.id, limit: DEFAULT_SESSION_SIZE })
      : getDueQueue({ userId: user.id, domain, limit: DEFAULT_SESSION_SIZE }),
  ]);

  // The Server Component boundary: only sanitized content ever leaves this
  // function. cardUpdate/content.correct/explanation stay server-side.
  const publicCards: PublicCard[] = queueCards
    .filter((c): c is typeof c & { type: (typeof SUPPORTED_TYPES)[number] } =>
      (SUPPORTED_TYPES as readonly string[]).includes(c.type)
    )
    .map((c) => ({
      id: c.id,
      domain: c.domain,
      topic: c.topic,
      type: c.type,
      content: toPublicContent(
        c.type,
        c.content as MultipleChoiceContent | MultipleSelectContent | ArtifactPbqContent | RemediationSelectContent
      ),
    }));

  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '40px 20px' }}>
      <h1>Study</h1>

      <nav style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '12px 0 24px' }}>
        <Link href="/study" style={{ fontWeight: !domain && !isWarmup ? 700 : 400 }}>
          All domains
        </Link>
        {domainRows.map((d) => (
          <Link
            key={d.domain}
            href={`/study?domain=${encodeURIComponent(d.domain)}`}
            style={{ fontWeight: domain === d.domain && !isWarmup ? 700 : 400 }}
          >
            {d.domain}
          </Link>
        ))}
        <Link href="/study?mode=warmup" style={{ fontWeight: isWarmup ? 700 : 400 }}>
          PBQ warm-up
        </Link>
      </nav>

      {publicCards.length === 0 ? (
        <p>
          {isWarmup ? 'No PBQ cards yet.' : `No cards due right now${domain ? ` in ${domain}` : ''}.`}
        </p>
      ) : (
        <StudySession initialCards={publicCards} />
      )}
    </main>
  );
}
