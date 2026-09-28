import Link from 'next/link';
import { HubCard } from '@/components/HubCard';

const gridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 };

export default function LearnHubPage() {
  return (
    <main style={{ maxWidth: 800, margin: '0 auto', padding: '40px 20px' }}>
      <p style={{ marginBottom: 16 }}>
        <Link href="/">&larr; Back to home</Link>
      </p>
      <h1 style={{ marginBottom: 24 }}>Learning</h1>
      <div style={gridStyle}>
        <HubCard
          href="/learning"
          title="Guided learning session"
          description="A structured session for new material: recall, typed cards, hands-on practice."
          comingSoon
        />
        <HubCard href="/library" title="Library" description="Read your source PDFs in-app, linked to topics." />
        <HubCard href="/topics" title="Topics" description="Notes, free recall, and cards per topic." />
        <HubCard href="/recall" title="Free recall" description="Write what you remember, get AI feedback." />
        <HubCard href="/create" title="Create cards" description="Turn a note into a new card." />
        <HubCard href="/review" title="Review cards" description="Approve new cards, flag bad ones." />
        <HubCard href="/search" title="Search" description="Search your notes and source material." />
      </div>
    </main>
  );
}
