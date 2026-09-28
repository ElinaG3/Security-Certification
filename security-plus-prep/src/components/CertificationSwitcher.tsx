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

  const ADD_CERT_VALUE = '__add__';

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const nextId = e.target.value;
    if (nextId === ADD_CERT_VALUE) {
      router.push('/certifications/new');
      return; // leave `value` pointing at the still-active cert — this option never "selects"
    }
    setValue(nextId);
    await setActiveCertification(nextId);
    // router.refresh() re-runs every Server Component on the current route
    // — every page already resolves the active cert via
    // getActiveCertificationId(), so this one refresh is what makes the
    // switch visible everywhere without a full navigation.
    startTransition(() => router.refresh());
  }

  // Always visible, even with only one certification — this is the
  // header's permanent "which cert am I looking at" control, not just a
  // multi-cert affordance. A single-option select is still meaningful
  // (confirms what's active) and is ready the instant a second cert exists.
  // "Add certification" rides along as the dropdown's last entry rather
  // than a separate link, per the home-page simplification.
  return (
    <select
      value={value}
      onChange={handleChange}
      disabled={pending}
      style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #ccc', fontWeight: 600, maxWidth: '100%' }}
    >
      {certifications.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name} ({c.examCode})
        </option>
      ))}
      <option value={ADD_CERT_VALUE}>+ Add certification</option>
    </select>
  );
}
