'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setActiveCertification } from '../../app/actions';
import type { CertificationOption } from '@/lib/active-certification';

export function CertificationSwitcher({
  certifications,
  activeCertificationId,
}: {
  certifications: CertificationOption[];
  activeCertificationId: string;
}) {
  const [value, setValue] = useState(activeCertificationId);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const nextId = e.target.value;
    setValue(nextId);
    await setActiveCertification(nextId);
    // router.refresh() re-runs every Server Component on the current route
    // — every page already resolves the active cert via
    // getActiveCertificationId(), so this one refresh is what makes the
    // switch visible everywhere without a full navigation.
    startTransition(() => router.refresh());
  }

  if (certifications.length <= 1) return null; // nothing to switch between yet

  return (
    <select
      value={value}
      onChange={handleChange}
      disabled={pending}
      style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #ccc', fontWeight: 600 }}
    >
      {certifications.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name} ({c.examCode})
        </option>
      ))}
    </select>
  );
}
