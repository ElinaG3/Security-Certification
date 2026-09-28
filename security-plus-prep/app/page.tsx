import { getCurrentUser } from '@/lib/auth';
import { getLearningProgress } from '@/lib/dashboard';
import { getProfileSettings } from '@/lib/profile-settings';
import { CountdownCard } from '@/components/home/CountdownCard';
import { ProgressCard } from '@/components/home/ProgressCard';

// Live progress/exam-date data on every load — no searchParams/cookies to
// otherwise signal dynamic rendering, so without this Next would
// statically prerender a stale snapshot at build time (same class of bug
// fixed on /review, /topics, and this page's own prior version).
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const user = await getCurrentUser();
  const [progress, settings] = await Promise.all([getLearningProgress(user.id), getProfileSettings()]);

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto' }}>
      <CountdownCard examDate={settings.examDate} />
      <ProgressCard domains={progress} />
    </div>
  );
}
