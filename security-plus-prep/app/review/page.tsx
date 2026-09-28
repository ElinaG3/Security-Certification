import Link from 'next/link';
import { listPendingCards, listActiveCards } from './actions';
import { ReviewBoard } from '@/components/review/ReviewBoard';
import { getActiveDomains } from '@/lib/active-certification';

// This page reads live cards data server-side on every load (pending
// queue, active-card spot-check) — without this, Next has no signal to
// treat it as dynamic (no searchParams/cookies/headers used) and would
// statically prerender it at BUILD time, baking in a stale snapshot that
// never reflects new pending cards or edits.
export const dynamic = 'force-dynamic';

export default async function ReviewPage() {
  const [pending, active, domains] = await Promise.all([listPendingCards(), listActiveCards({}), getActiveDomains()]);

  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '40px 20px' }}>
      <p style={{ marginBottom: 16 }}>
        <Link href="/study">&larr; Back to study</Link>
      </p>
      <h1>Review</h1>
      <p style={{ color: '#666', marginBottom: 24 }}>
        Approve/edit/reject cards awaiting review, or spot-check and flag anything already active.
      </p>
      <ReviewBoard pending={pending} activeInitial={active.cards} activeTotal={active.total} domains={domains} />
    </main>
  );
}
