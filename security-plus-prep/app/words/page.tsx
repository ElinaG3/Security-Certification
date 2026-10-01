import Link from 'next/link';
import { listTerms } from './actions';
import { WordsList } from '@/components/words/WordsList';

export default async function WordsPage({ searchParams }: { searchParams: Promise<{ sort?: string }> }) {
  const { sort } = await searchParams;
  const initialSort = sort === 'newest' ? 'newest' : 'most_looked_up';
  const terms = await listTerms(initialSort);

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <p style={{ marginBottom: 16 }}>
        <Link href="/learn">&larr; Back to learning</Link>
      </p>
      <h1 style={{ fontSize: 24, marginBottom: 16 }}>Saved words</h1>
      <WordsList initialTerms={terms} initialSort={initialSort} />
    </div>
  );
}
