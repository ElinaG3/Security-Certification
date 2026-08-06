import Link from 'next/link';
import { getDb } from '@/db';
import { cards } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth';
import { sql, eq } from 'drizzle-orm';

export default async function Home() {
  let user;
  let domainCounts: { domain: string; count: number }[] = [];
  let error: string | null = null;

  try {
    user = await getCurrentUser();
    const db = getDb();
    const rows = await db
      .select({ domain: cards.domain, count: sql<number>`count(*)::int` })
      .from(cards)
      .where(eq(cards.userId, user.id))
      .groupBy(cards.domain);
    domainCounts = rows;
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  return (
    <main style={{ maxWidth: 600, margin: '0 auto', padding: '40px 20px' }}>
      <h1>Security+ Study — Phase 1 smoke test</h1>
      {error ? (
        <p style={{ color: '#c0392b' }}>Error: {error}</p>
      ) : (
        <>
          <p>User: {user?.email}</p>
          <h2 style={{ marginTop: 24 }}>Seeded cards by domain</h2>
          <ul>
            {domainCounts.map((d) => (
              <li key={d.domain}>
                {d.domain}: {d.count}
              </li>
            ))}
          </ul>
          <p style={{ marginTop: 24 }}>
            <Link href="/study">Start studying &rarr;</Link>
          </p>
        </>
      )}
    </main>
  );
}
