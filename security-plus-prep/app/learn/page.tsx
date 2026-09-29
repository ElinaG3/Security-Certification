import { FeatureBigCard } from '@/components/home/FeatureBigCard';
import { BookOpenIcon, BrainIcon, ClockIcon, BookIcon } from '@/components/icons';
import { getTodayRoutineSummary } from '@/lib/routine';

const gridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(240px, 1fr))', gap: 16 };

export default async function LearnHubPage() {
  const { completedToday } = await getTodayRoutineSummary();

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ fontSize: 26, marginBottom: 6 }}>Learning</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>Read, take notes, and learn new topics.</p>

      <div style={gridStyle}>
        <FeatureBigCard href="/topics" icon={<BookIcon size={22} />} title="Topics" description="Notes, free recall, and cards per objective." />
        <FeatureBigCard
          href="/learning"
          icon={<ClockIcon size={22} />}
          title="Learning routine"
          description={completedToday ? 'Done today ✓ — see your results.' : 'A structured session for new material: recall, typed cards, hands-on practice.'}
        />
        <FeatureBigCard href="/recall" icon={<BrainIcon size={22} />} title="Free recall" description="Write what you remember, get AI feedback." />
        <FeatureBigCard href="/library" icon={<BookOpenIcon size={22} />} title="Library" description="Read your source PDFs in-app, linked to topics." />
      </div>
    </div>
  );
}
