import Link from 'next/link';
import { HubCard } from '@/components/HubCard';

const gridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 };

export default function PracticeHubPage() {
  return (
    <main style={{ maxWidth: 800, margin: '0 auto', padding: '40px 20px' }}>
      <p style={{ marginBottom: 16 }}>
        <Link href="/">&larr; Back to home</Link>
      </p>
      <h1 style={{ marginBottom: 24 }}>Practicing</h1>
      <div style={gridStyle}>
        <HubCard href="/study" title="Daily study" description="Today's due questions." />
        <HubCard href="/study?mode=warmup" title="PBQ warm-up" description="Performance-based questions under a timer." />
      </div>
    </main>
  );
}
