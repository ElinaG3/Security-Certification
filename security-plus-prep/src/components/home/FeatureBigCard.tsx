import Link from 'next/link';
import type { ReactNode } from 'react';

export function FeatureBigCard({
  href,
  icon,
  title,
  description,
  disabled = false,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  description: string;
  disabled?: boolean;
}) {
  const content = (
    <div
      className="card"
      style={{
        padding: '24px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        background: disabled ? 'var(--neutral-tint)' : 'var(--card-bg)',
        opacity: disabled ? 0.85 : 1,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 44,
            height: 44,
            borderRadius: 12,
            background: disabled ? '#e7e4db' : 'var(--accent-tint)',
            color: disabled ? 'var(--text-secondary)' : 'var(--accent)',
          }}
        >
          {icon}
        </span>
        {disabled && <span className="pill pill-neutral">Coming soon</span>}
      </div>
      <div>
        <p style={{ fontFamily: 'var(--font-heading)', fontSize: 20, marginBottom: 6, color: disabled ? 'var(--text-secondary)' : 'var(--text)' }}>
          {title}
        </p>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{description}</p>
      </div>
    </div>
  );

  if (disabled) {
    return <div style={{ height: '100%', cursor: 'default' }}>{content}</div>;
  }

  return (
    <Link href={href} style={{ display: 'block', height: '100%' }}>
      {content}
    </Link>
  );
}
