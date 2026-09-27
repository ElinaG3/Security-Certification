import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { listTopics } from '@/lib/topics';
import { SY0_701_DOMAINS } from '@/lib/domains';

// listTopics reads live card data — no searchParams/cookies to signal
// dynamic rendering otherwise, so without this Next would statically
// prerender a stale snapshot at build time (same issue fixed on /review).
export const dynamic = 'force-dynamic';

export default async function TopicsIndexPage() {
  const user = await getCurrentUser();
  const { topics, orphanCount } = await listTopics(user.id);

  const byDomain = new Map<string, typeof topics>();
  for (const t of topics) {
    if (!byDomain.has(t.domain)) byDomain.set(t.domain, []);
    byDomain.get(t.domain)!.push(t);
  }

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '40px 20px' }}>
      <p style={{ marginBottom: 16 }}>
        <Link href="/study">&larr; Back to study</Link>
      </p>
      <h1>Topics</h1>
      <p style={{ color: '#666', marginBottom: 24 }}>
        One page per SY0-701 objective — its cards, and (once Recall mode ships) your notes and drawings.
      </p>

      {orphanCount > 0 && (
        <p style={{ fontSize: 13, color: '#999', marginBottom: 20 }}>
          {orphanCount} active card(s) have no objective assigned yet and won&apos;t appear on any topic page.
        </p>
      )}

      {SY0_701_DOMAINS.map((domain) => {
        const domainTopics = byDomain.get(domain) ?? [];
        if (domainTopics.length === 0) return null;
        return (
          <section key={domain} style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 16, color: '#444', marginBottom: 10 }}>{domain}</h2>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {domainTopics.map((t) => (
                <li key={t.objective} style={{ marginBottom: 6 }}>
                  <Link
                    href={`/topics/${encodeURIComponent(t.objective)}`}
                    style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', border: '1px solid #eee', borderRadius: 6 }}
                  >
                    <span>{t.label}</span>
                    <span style={{ color: '#999' }}>{t.cardCount}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </main>
  );
}
