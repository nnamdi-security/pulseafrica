'use client';

import { useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';

import { usePolls, useReference, useStats } from '@/lib/api/queries';
import { liveTickerItems, PLACEHOLDER_ITEMS, type TickerItem } from '@/lib/live';
import { cn } from '@/lib/utils';

const SCROLL_PX_PER_SECOND = 45;
/* The ticker shares the stats and polls queries with the page. The page's server data is
   streamed after the shell, and HydrationBoundary defers data for queries already in the
   cache, so a ticker that went live first would make the page hydrate without its data
   (React #418). The ticker waits until the document has finished streaming and React is idle. */
let settled = false;
function subscribeSettled(notify: () => void) {
  if (settled) return () => {};
  let idle = 0;
  const done = () => {
    settled = true;
    notify();
  };
  const onLoad = () => {
    idle = window.requestIdleCallback ? window.requestIdleCallback(done, { timeout: 2000 }) : window.setTimeout(done, 0);
  };
  if (document.readyState === 'complete') onLoad();
  else window.addEventListener('load', onLoad, { once: true });
  return () => {
    window.removeEventListener('load', onLoad);
    if (window.cancelIdleCallback) window.cancelIdleCallback(idle);
    else window.clearTimeout(idle);
  };
}

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

    The figures are read only after the first render in the browser. The ticker renders before
    the page, so reading them earlier would create the page's queries before its prefetched data
    is hydrated (decision 0021), and TanStack Query would then hold that data back until after
    hydration: the page would hydrate empty against server HTML that has its figures. */
export function Ticker() {
  const live = useSyncExternalStore(
    subscribeSettled,
    () => settled,
    () => false,
  );
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
