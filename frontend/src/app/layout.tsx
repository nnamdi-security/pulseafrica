import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { LegacyHashRedirect } from '@/components/layout/LegacyHashRedirect';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { Ticker } from '@/components/layout/Ticker';
import '@/styles/globals.css';

import { fraunces, inter, spaceMono } from './fonts';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'PulseAfrica — The People’s Voice, In Data',
  description:
    'PulseAfrica — an independent, non-partisan civic opinion research platform for the United States of Africa. Participate in polls, view real data, and hold leadership accountable.',
};

/** The shell every page shares: ticker, nav, content, footer (FE-02: once, not 9 copies) */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable} ${spaceMono.variable}`}>
      <body>
        <Providers>
          <LegacyHashRedirect />
          <Ticker />
          <SiteHeader />
          <main id="main">{children}</main>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
