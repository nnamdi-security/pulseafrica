'use client';

/* The tabs under the Dashboard's and Admin's page heads (style.css .results-tabs). Each tab is
   a route; Left and Right move between them, as on dashboard.html and admin.html. */
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useRef } from 'react';

import { cn } from '@/lib/utils';

export type PageTab = { href: string; label: string; id: string };

/** The tab whose route this is, or holds it (/admin/polls/new is under Polls); else the first */
export function selectedTab(tabs: readonly PageTab[], pathname: string) {
  return tabs.find((t) => t.href === pathname) ?? tabs.find((t, i) => i > 0 && pathname.startsWith(`${t.href}/`)) ?? tabs[0]!;
}

export function PageTabs({ tabs, label, panelId }: { tabs: readonly PageTab[]; label: string; panelId: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const refs = useRef<(HTMLAnchorElement | null)[]>([]);
  const current = selectedTab(tabs, pathname);
  return (
    <div role="tablist" aria-label={label} className="flex border-b border-navy/10 bg-white px-10 tablet:overflow-x-auto tablet:px-6">
      {tabs.map((tab, i) => {
        const selected = tab === current;
        return (
          <Link
            key={tab.href}
            ref={(el) => {
              refs.current[i] = el;
            }}
            href={tab.href}
            id={tab.id}
            role="tab"
            aria-selected={selected}
            aria-controls={panelId}
            tabIndex={selected ? 0 : -1}
            onKeyDown={(e) => {
              if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
              e.preventDefault();
              const to = (i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length;
              router.push(tabs[to]!.href);
              refs.current[to]?.focus();
            }}
            className={cn(
              'border-b-2 border-transparent px-5 py-[15px] font-mono text-[10px] uppercase tracking-[0.08em] text-muted transition-colors hover:text-navy focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-gold tablet:px-3.5 tablet:py-3.5 tablet:whitespace-nowrap',
              selected && 'border-gold text-navy',
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
