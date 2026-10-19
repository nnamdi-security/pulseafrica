'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { Logo } from './Logo';
import { NavAuth } from './NavAuth';

const LINKS = [
  { href: '/', label: 'Home' },
  { href: '/polls', label: 'Polls' },
  { href: '/results', label: 'Results' },
  { href: '/methodology', label: 'Methodology' },
  { href: '/about', label: 'About' },
];

function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/');
}

/** Main navigation (style.css .nav). At ≤ 900px the links fold behind a toggle. */
export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <nav
      className="sticky top-0 z-100 flex h-16 items-center justify-between bg-navy px-10 tablet:px-6"
      aria-label="Main navigation"
    >
      <Logo />

      <ul
        id="nav-links"
        role="list"
        className={cn(
          'flex gap-8',
          open
            ? 'tablet:absolute tablet:inset-x-0 tablet:top-16 tablet:flex-col tablet:gap-5 tablet:border-t tablet:border-gold/18 tablet:bg-navy tablet:px-6 tablet:pt-5 tablet:pb-6'
            : 'tablet:hidden',
        )}
      >
        {LINKS.map(({ href, label }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                className={cn(
                  'text-[13px] font-medium tracking-[0.02em] text-parchment/65 hover:text-parchment',
                  active && 'text-gold hover:text-gold',
                )}
                aria-current={active ? 'page' : undefined}
                onClick={close}
              >
                {label}
              </Link>
            </li>
          );
        })}
        <NavAuth onNavigate={close} />
      </ul>

      {/* Inert on the current pages too (FE-05); it stays as it is until the pages move */}
      <Button>Share Your Voice</Button>

      <button
        type="button"
        className="hidden flex-col gap-[5px] p-1 tablet:flex"
        aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
        aria-expanded={open}
        aria-controls="nav-links"
        onClick={() => setOpen(!open)}
      >
        <span className="block h-0.5 w-[22px] rounded-[2px] bg-parchment" />
        <span className="block h-0.5 w-[22px] rounded-[2px] bg-parchment" />
        <span className="block h-0.5 w-[22px] rounded-[2px] bg-parchment" />
      </button>
    </nav>
  );
}
