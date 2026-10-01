import type { Metadata } from 'next';
import { Fraunces, IBM_Plex_Sans } from 'next/font/google';
import { Analytics } from '@vercel/analytics/react';
import { NavShell } from '@/components/nav/NavShell';
import { WordTranslatorWidget } from '@/components/words/WordTranslatorWidget';
import { getActiveCertification, listCertifications } from '@/lib/active-certification';
import './globals.css';

const fraunces = Fraunces({ subsets: ['latin'], weight: ['600'], variable: '--font-fraunces' });
const plexSans = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-plex-sans' });

export const metadata: Metadata = {
  title: 'Security+ Study',
};

// The shared chrome (top bar / mobile header / bottom tab bar) needs the
// active certification on every single page, so it's fetched once here
// rather than duplicated per-route — getActiveCertification/
// listCertifications are already React cache()'d, so a page that also
// calls them pays no extra DB round trip.
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [activeCert, certifications] = await Promise.all([getActiveCertification(), listCertifications()]);

  return (
    <html lang="en" className={`${fraunces.variable} ${plexSans.variable}`}>
      <body>
        <NavShell
          certifications={certifications}
          activeCertificationId={activeCert.id}
          activeName={activeCert.name}
          activeExamCode={activeCert.examCode}
        />
        <main className="app-main">{children}</main>
        <WordTranslatorWidget />
        <Analytics />
      </body>
    </html>
  );
}
