import Link from 'next/link';

export function HubCard({
  href,
  title,
  description,
  comingSoon,
}: {
  href: string;
  title: string;
  description: string;
  comingSoon?: boolean;
}) {
  return (
    <Link
      href={href}
      style={{
        display: 'block',
        padding: '16px 18px',
        border: '1px solid #ddd',
        borderRadius: 8,
        background: '#fff',
      }}
    >
      <p style={{ fontWeight: 700, marginBottom: 4 }}>
        {title}
        {comingSoon && <span style={{ fontWeight: 400, fontSize: 12, color: '#999' }}> — Coming soon</span>}
      </p>
      <p style={{ fontSize: 13, color: '#666', margin: 0 }}>{description}</p>
    </Link>
  );
}
