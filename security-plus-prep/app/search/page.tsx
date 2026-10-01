import Link from 'next/link';
import { SearchBox } from '@/components/SearchBox';

export default function SearchPage() {
  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <p style={{ marginBottom: 16 }}>
        <Link href="/study">&larr; Back to study</Link>
      </p>
      <h1>Search notes</h1>
      <p style={{ color: '#666', marginBottom: 24 }}>
        Semantic search over ingested source material (currently: Professor Messer&apos;s course notes).
      </p>
      <SearchBox />
    </div>
  );
}
