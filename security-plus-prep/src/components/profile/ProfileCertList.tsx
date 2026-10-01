'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { setActiveCertification } from '../../../app/actions';
import { CheckIcon, PlusIcon } from '@/components/icons';
import type { CertificationOption } from '@/lib/active-certification';

export function ProfileCertList({ certifications, activeCertificationId }: { certifications: CertificationOption[]; activeCertificationId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  async function handleSelect(id: string) {
    if (id === activeCertificationId) return;
    await setActiveCertification(id);
    startTransition(() => router.refresh());
  }

  return (
    <div>
      {certifications.map((c) => {
        const active = c.id === activeCertificationId;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => handleSelect(c.id)}
            disabled={pending}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              textAlign: 'left',
              padding: '12px 14px',
              marginBottom: 8,
              borderRadius: 10,
              border: `1px solid ${active ? 'var(--accent)' : 'var(--card-border)'}`,
              background: active ? 'var(--accent-tint)' : '#fff',
              cursor: active ? 'default' : 'pointer',
            }}
          >
            <span>
              <span style={{ display: 'block', fontWeight: 600, fontSize: 14, color: active ? 'var(--accent)' : 'var(--text)' }}>{c.name}</span>
              <span style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)' }}>{c.examCode}</span>
            </span>
            {active && <CheckIcon size={18} />}
          </button>
        );
      })}
      <Link href="/certifications/new" className="btn" style={{ width: '100%' }}>
        <PlusIcon size={16} /> Add certification
      </Link>
    </div>
  );
}
