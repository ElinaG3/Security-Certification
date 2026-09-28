import Link from 'next/link';
import { CreateCardForm } from '@/components/CreateCardForm';
import { getActiveDomains } from '@/lib/active-certification';

// A client component can't await a DB-backed domain list itself — fetched
// here (Server Component) and passed down as a prop instead of
// CreateCardForm importing a hardcoded constant.
export const dynamic = 'force-dynamic';

export default async function CreatePage({
  searchParams,
}: {
  searchParams: Promise<{ domain?: string; objective?: string }>;
}) {
  const [domains, { domain, objective }] = await Promise.all([getActiveDomains(), searchParams]);

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <p style={{ marginBottom: 16 }}>
        <Link href="/study">&larr; Back to study</Link>
      </p>
      <h1>Create card</h1>
      <p style={{ color: '#666', marginBottom: 24 }}>
        Paste a note, generate a draft, fix it by hand, save it straight into the deck.
      </p>
      <CreateCardForm domains={domains} initialDomain={domain} initialObjective={objective} />
    </div>
  );
}
