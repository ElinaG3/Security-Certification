import Link from 'next/link';
import { getProfileSettings } from '@/lib/profile-settings';
import { getActiveCertification, listCertifications } from '@/lib/active-certification';
import { ExamDateForm } from '@/components/profile/ExamDateForm';
import { DailyQuestionCountForm } from '@/components/profile/DailyQuestionCountForm';
import { ProfileCertList } from '@/components/profile/ProfileCertList';
import { FlagIcon, CheckIcon } from '@/components/icons';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const [settings, activeCert, certifications] = await Promise.all([
    getProfileSettings(),
    getActiveCertification(),
    listCertifications(),
  ]);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ fontSize: 26, marginBottom: 24 }}>Profile</h1>

      <section className="card" style={{ padding: 24, marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, marginBottom: 4 }}>{activeCert.name}</h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 18 }}>Settings below apply to {activeCert.examCode}.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <ExamDateForm initialDate={settings.examDate} />
          <DailyQuestionCountForm initialCount={settings.dailyQuestionCount} isDefault={settings.dailyQuestionCountIsDefault} />
        </div>
      </section>

      <section className="card" style={{ padding: 24, marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, marginBottom: 14 }}>Certifications</h2>
        <ProfileCertList certifications={certifications} activeCertificationId={activeCert.id} />
      </section>

      <section className="card" style={{ padding: 24 }}>
        <h2 style={{ fontSize: 16, marginBottom: 14 }}>Card management</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Link href="/review" className="btn" style={{ justifyContent: 'flex-start' }}>
            <CheckIcon size={16} /> Review new cards
          </Link>
          <Link href="/review?flagged=true" className="btn" style={{ justifyContent: 'flex-start' }}>
            <FlagIcon size={16} /> Flagged cards
          </Link>
        </div>
      </section>
    </div>
  );
}
