import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { listTopics } from '@/lib/topics';
import { getActiveDomains } from '@/lib/active-certification';

export const dynamic = 'force-dynamic';

export default async function RecallIndexPage() {
  const user = await getCurrentUser();
  const [{ topics }, activeDomains] = await Promise.all([listTopics(user.id), getActiveDomains()]);

  const byDomain = new Map<string, typeof topics>();
  for (const t of topics) {
    if (!byDomain.has(t.domain)) byDomain.set(t.domain, []);
    byDomain.get(t.domain)!.push(t);
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <p style={{ marginBottom: 16 }}>
        <Link href="/study">&larr; Back to study</Link>
      </p>
      <h1>Recall</h1>
      <p style={{ color: '#666', marginBottom: 24 }}>
        Pick a topic and write (or draw, or handwrite) everything you know from memory.
      </p>

      {activeDomains.map((domain) => {
        const domainTopics = byDomain.get(domain) ?? [];
        if (domainTopics.length === 0) return null;
        return (
          <section key={domain} style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 16, color: '#444', marginBottom: 10 }}>{domain}</h2>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {domainTopics.map((t) => (
                <li key={t.objective} style={{ marginBottom: 6 }}>
                  <Link href={`/recall/${encodeURIComponent(t.objective)}`} style={{ display: 'block', padding: '8px 10px', border: '1px solid #eee', borderRadius: 6 }}>
                    {t.label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
