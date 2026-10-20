'use client';

import { useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';

import { usePolls, useReference, useStats } from '@/lib/api/queries';
import { liveTickerItems, PLACEHOLDER_ITEMS, type TickerItem } from '@/lib/live';
import { isPageReady, subscribePageReady } from '@/lib/page-ready';
import { cn } from '@/lib/utils';

const SCROLL_PX_PER_SECOND = 45;

function Item({ item, hidden }: { item: TickerItem; hidden?: boolean }) {
  return (
    <div
      className="inline-flex items-center gap-2 border-r border-gold/30 px-7"
      aria-hidden={hidden ? 'true' : undefined}
    >
      <span className={cn('size-1.5 shrink-0 rounded-full', item.warn ? 'bg-gold' : 'bg-green')} />
      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-gold">{item.label}</span>
      <span className="font-mono text-[12px] font-bold text-parchment">{item.value}</span>
    </div>
  );
}

/** Live platform figures (ticker.js). Until they arrive, or if they never do, a neutral placeholder.

    The figures are read only once the page's own server data has hydrated (lib/page-ready.ts).
    The ticker renders before the page, so reading them earlier would create the page's queries
    before its prefetched data is hydrated (decision 0021), and TanStack Query would then hold
    that data back until after hydration: the page would hydrate empty against server HTML that
    has its figures. */
export function Ticker() {
  // After the page's own data has hydrated (lib/page-ready.ts)
  const live = useSyncExternalStore(subscribePageReady, isPageReady, () => false);
  return live ? <LiveTicker /> : <TickerStrip items={PLACEHOLDER_ITEMS} live={false} demo={false} />;
}

function LiveTicker() {
  const stats = useStats();
  const polls = usePolls();
  const reference = useReference();

  // Like ticker.js: the reference list only names categories, so the ticker goes live without it
  const live = Boolean(stats.data && polls.data && !reference.isPending);
  const items = useMemo(
    () =>
      live && stats.data && polls.data
        ? liveTickerItems(stats.data, polls.data, reference.data?.categories ?? [])
        : PLACEHOLDER_ITEMS,
    [live, stats.data, polls.data, reference.data],
  );
  const demo = live && (stats.data?.syntheticPolls ?? 0) > 0;
  return <TickerStrip items={items} live={live} demo={demo} />;
}

function TickerStrip({ items, live, demo }: { items: TickerItem[]; live: boolean; demo: boolean }) {
  /* The strip scrolls by exactly half its width, so the items appear twice. A short list is
     repeated first so that one half is wider than the screen and no gap shows at the seam.
     The copies are hidden from screen readers. */
  const inner = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<{ items: TickerItem[]; repeats: number; seconds: number } | null>(null);

  useLayoutEffect(() => {
    const el = inner.current;
    if (!el || layout?.items === items) return;
    const setWidth = el.scrollWidth || 1;
    const repeats = Math.max(1, Math.ceil(window.innerWidth / setWidth));
    setLayout({ items, repeats, seconds: Math.round((setWidth * repeats) / SCROLL_PX_PER_SECOND) });
  }, [items, layout]);

  const measured = layout?.items === items ? layout : null;
  const copies = measured ? measured.repeats * 2 - 1 : 0;

  return (
    <div
      className="overflow-hidden border-b-2 border-gold bg-navy py-[9px] whitespace-nowrap motion-reduce:overflow-x-auto"
      aria-label={
        !live ? 'About PulseAfrica' : demo ? 'Live platform figures, including demonstration data' : 'Live platform figures'
      }
      data-testid="ticker"
      data-state={live ? 'live' : 'placeholder'}
    >
      <div
        ref={inner}
        className="inline-flex animate-ticker motion-reduce:animate-none"
        style={measured ? { animationDuration: `${measured.seconds}s` } : undefined}
      >
        {items.map((item, i) => (
          <Item key={`once-${i}`} item={item} />
        ))}
        {Array.from({ length: copies }, (_, copy) =>
          items.map((item, i) => <Item key={`copy-${copy}-${i}`} item={item} hidden />),
        )}
      </div>
    </div>
  );
}
