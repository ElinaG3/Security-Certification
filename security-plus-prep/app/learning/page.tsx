import Link from 'next/link';
import { getOrStartTodayRoutine, listAllTopics } from '@/lib/routine';
import { RoutineSession } from '@/components/learning/RoutineSession';

// The Guided Learning Session — Core (C1-C4). Replaces the placeholder in
// place, same route (see the old comment this file used to carry).
export default async function LearningPage() {
  const session = await getOrStartTodayRoutine();
  const topicChoices = session.topic ? [] : await listAllTopics();

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <p style={{ marginBottom: 16 }}>
        <Link href="/learn">&larr; Back to learning</Link>
      </p>
      <RoutineSession initialSession={session} topicChoices={topicChoices} />
    </div>
  );
}
