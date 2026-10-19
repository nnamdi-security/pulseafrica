import Link from 'next/link';

import { Logo } from './Logo';

/* Entries with a page link to it; the rest are plain text until their pages exist (decision 0019) */
const COLUMNS: { title: string; entries: { label: string; href?: string }[] }[] = [
  {
    title: 'Platform',
    entries: [
      { label: 'Active Polls', href: '/polls' },
      { label: 'Results Dashboard', href: '/results' },
      { label: 'Methodology', href: '/methodology' },
      { label: 'State Tracker' },
    ],
  },
  {
    title: 'About',
    entries: [{ label: 'Our Mission', href: '/about' }, { label: 'The Team' }, { label: 'FAQ' }, { label: 'Press' }],
  },
  {
    title: 'Legal',
    entries: [
      { label: 'Privacy Policy' },
      { label: 'Terms of Use' },
      { label: 'Data Ethics' },
      { label: 'Cookie Policy' },
    ],
  },
];

const ENTRY = 'mb-[9px] block text-[13px] text-parchment/50';

/** Site footer (style.css footer). Faint text is at the faintest tint that passes WCAG AA (decision 0017). */
export function SiteFooter() {
  return (
    <footer
      className="border-t border-gold/18 bg-navy px-10 pt-12 pb-7 tablet:px-6 tablet:pt-10 tablet:pb-6"
      aria-label="Site footer"
    >
      <div className="mb-9 grid grid-cols-[2fr_1fr_1fr_1fr] gap-9 tablet:grid-cols-2 tablet:gap-7 mobile:grid-cols-1">
        <div>
          <Logo />
          <p className="mt-3.5 max-w-[270px] text-[13px] leading-[1.75] text-parchment/50">
            An independent, non-partisan civic opinion research platform for the United States of Africa. We measure
            what citizens believe — not what governments claim.
          </p>
        </div>

        {COLUMNS.map((column) => (
          <div key={column.title}>
            <h5 className="mb-4 font-mono text-[10px] uppercase tracking-[0.18em] text-gold">{column.title}</h5>
            {column.entries.map((entry) =>
              entry.href ? (
                <Link key={entry.label} href={entry.href} className={`${ENTRY} hover:text-parchment`}>
                  {entry.label}
                </Link>
              ) : (
                <span key={entry.label} className={ENTRY}>
                  {entry.label}
                </span>
              ),
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-parchment/7 pt-[22px] mobile:flex-col mobile:items-start">
        <span className="font-mono text-[10px] tracking-[0.04em] text-parchment/50">
          © 2026 PulseAfrica · Non-partisan · Non-governmental · Independent
        </span>
        <div className="flex flex-wrap gap-2.5" aria-label="Trust certifications">
          {['Totals Only', 'Open Methodology', 'No Party Affiliation'].map((badge) => (
            <span
              key={badge}
              className="rounded-xs border border-parchment/14 px-[9px] py-[3px] font-mono text-[10px] uppercase tracking-[0.08em] text-parchment/50"
            >
              {badge}
            </span>
          ))}
        </div>
      </div>
    </footer>
  );
}
