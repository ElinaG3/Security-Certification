'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { setActiveCertification } from '../../../app/actions';
import { ChevronDownIcon, PlusIcon } from '@/components/icons';
import type { CertificationOption } from '@/lib/active-certification';

export function CertDropdown({
  certifications,
  activeCertificationId,
  activeName,
  activeExamCode,
  compact = false,
}: {
  certifications: CertificationOption[];
  activeCertificationId: string;
  activeName: string;
  activeExamCode: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  async function handleSelect(id: string) {
    setOpen(false);
    if (id === activeCertificationId) return;
    await setActiveCertification(id);
    startTransition(() => router.refresh());
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          minHeight: 44,
          padding: compact ? '0 10px' : '0 14px',
          border: '1px solid var(--card-border)',
          borderRadius: 10,
          background: '#fff',
          cursor: 'pointer',
        }}
      >
        {!compact && (
          <span style={{ textAlign: 'left' }}>
            <span style={{ display: 'block', fontWeight: 600, fontSize: 14, lineHeight: 1.2 }}>{activeName}</span>
            <span style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.2 }}>{activeExamCode}</span>
          </span>
        )}
        {compact && <span style={{ fontWeight: 600, fontSize: 13 }}>{activeExamCode}</span>}
        <ChevronDownIcon size={14} className="chevron" />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            minWidth: 240,
            background: '#fff',
            border: '1px solid var(--card-border)',
            borderRadius: 12,
            boxShadow: '0 8px 24px rgba(28,30,29,0.12)',
            zIndex: 40,
            overflow: 'hidden',
          }}
        >
          {certifications.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => handleSelect(c.id)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '10px 14px',
                border: 'none',
                background: c.id === activeCertificationId ? 'var(--accent-tint)' : '#fff',
                cursor: 'pointer',
              }}
            >
              <span style={{ display: 'block', fontWeight: 600, fontSize: 14, color: c.id === activeCertificationId ? 'var(--accent)' : 'var(--text)' }}>
                {c.name}
              </span>
              <span style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)' }}>{c.examCode}</span>
            </button>
          ))}
          <Link
            href="/certifications/new"
            onClick={() => setOpen(false)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '10px 14px',
              borderTop: '1px solid var(--card-border)',
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--accent)',
            }}
          >
            <PlusIcon size={16} /> Add certification
          </Link>
        </div>
      )}
    </div>
  );
}
