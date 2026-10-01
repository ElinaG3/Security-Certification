'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CertDropdown } from './CertDropdown';
import { HomeIcon, BookIcon, TargetIcon, UserIcon, SearchIcon } from '@/components/icons';
import type { CertificationOption } from '@/lib/active-certification';

const LEARNING_PREFIXES = ['/learn', '/learning', '/topics', '/library', '/recall', '/create', '/review', '/search'];
const PRACTICE_PREFIXES = ['/practice', '/study'];
const PROFILE_PREFIXES = ['/profile', '/certifications'];

function matches(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`) || pathname.startsWith(`${p}?`));
}

export function NavShell({
  certifications,
  activeCertificationId,
  activeName,
  activeExamCode,
}: {
  certifications: CertificationOption[];
  activeCertificationId: string;
  activeName: string;
  activeExamCode: string;
}) {
  const pathname = usePathname();
  const isHome = pathname === '/';
  const isLearning = matches(pathname, LEARNING_PREFIXES);
  const isPractice = matches(pathname, PRACTICE_PREFIXES);
  const isProfile = matches(pathname, PROFILE_PREFIXES);

  return (
    <>
      {/* Desktop top bar */}
      <header
        className="topbar"
        style={{
          height: 'var(--topbar-height)',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 32px',
          background: '#fff',
          borderBottom: '1px solid var(--card-border)',
          position: 'sticky',
          top: 0,
          zIndex: 30,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link
            href="/"
            aria-label="Home"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 40,
              height: 40,
              borderRadius: 10,
              background: 'var(--accent)',
              color: '#fff',
              fontFamily: 'var(--font-heading)',
              fontWeight: 600,
              fontSize: 16,
            }}
          >
            S+
          </Link>
          <CertDropdown
            certifications={certifications}
            activeCertificationId={activeCertificationId}
            activeName={activeName}
            activeExamCode={activeExamCode}
          />
        </div>

        <nav style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Link href="/learn" className={`nav-link ${isLearning ? 'active' : ''}`}>
            <BookIcon size={18} /> Learning
          </Link>
          <Link href="/practice" className={`nav-link ${isPractice ? 'active' : ''}`}>
            <TargetIcon size={18} /> Practice
          </Link>
          <Link href="/profile" className={`nav-link ${isProfile ? 'active' : ''}`}>
            <UserIcon size={18} /> Profile
          </Link>
          <Link
            href="/search"
            aria-label="Search"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 44,
              height: 44,
              borderRadius: 10,
              color: 'var(--text-secondary)',
            }}
          >
            <SearchIcon size={20} />
          </Link>
        </nav>
      </header>

      {/* Phone: slim header */}
      <header
        className="mobile-header"
        style={{
          height: 'var(--topbar-height)',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          background: '#fff',
          borderBottom: '1px solid var(--card-border)',
          position: 'sticky',
          top: 0,
          zIndex: 30,
        }}
      >
        <CertDropdown
          certifications={certifications}
          activeCertificationId={activeCertificationId}
          activeName={activeName}
          activeExamCode={activeExamCode}
          compact
        />
        <Link
          href="/search"
          aria-label="Search"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, color: 'var(--text-secondary)' }}
        >
          <SearchIcon size={20} />
        </Link>
      </header>

      {/* Phone: bottom tab bar */}
      <nav
        className="bottombar"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: '#fff',
          borderTop: '1px solid var(--card-border)',
          zIndex: 30,
        }}
      >
        <Link href="/" className={`bottom-tab ${isHome ? 'active' : ''}`}>
          <HomeIcon size={20} />
          Home
        </Link>
        <Link href="/learn" className={`bottom-tab ${isLearning ? 'active' : ''}`}>
          <BookIcon size={20} />
          Learning
        </Link>
        <Link href="/practice" className={`bottom-tab ${isPractice ? 'active' : ''}`}>
          <TargetIcon size={20} />
          Practice
        </Link>
        <Link href="/profile" className={`bottom-tab ${isProfile ? 'active' : ''}`}>
          <UserIcon size={20} />
          Profile
        </Link>
      </nav>
    </>
  );
}
