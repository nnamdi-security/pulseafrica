'use client';

/* One Chart.js chart (decision 0021): the library is imported only when a chart is drawn, so it
   isn't in any route's first-load JavaScript. The canvas carries a text alternative, and if the
   library can't load the box says so instead of staying blank, as results.html does. */
import type { ChartConfiguration } from 'chart.js';
import { useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

/** A theme colour's value, read from the page so charts use the same tokens as the CSS */
export function themeColor(name: string, alpha = 1) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(`--color-${name}`).trim();
  if (alpha === 1 || !/^#[0-9a-f]{6}$/i.test(value)) return value;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Builds the configuration in the browser, where theme colours can be read */
export type ConfigFor = () => ChartConfiguration;

export function Chart({ config, label, height, className }: { config: ConfigFor; label: string; height: number; className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [missing, setMissing] = useState(false);
  // The configuration changes identity on every render; redraw only when what it shows changes
  const latest = useRef(config);
  useEffect(() => {
    latest.current = config;
  });

  useEffect(() => {
    let chart: { destroy: () => void } | null = null;
    let cancelled = false;
    import('chart.js/auto')
      .then(({ default: ChartJS }) => {
        if (cancelled || !canvas.current) return;
        setMissing(false);
        chart = new ChartJS(canvas.current, latest.current());
      })
      .catch(() => {
        if (!cancelled) setMissing(true);
      });
    return () => {
      cancelled = true;
      chart?.destroy();
    };
  }, [label]);

  return (
    <div className={cn('relative w-full', className)} style={{ height }}>
      <canvas ref={canvas} role="img" aria-label={label}>
        {label}
      </canvas>
      {missing ? (
        <p className="absolute inset-0 flex items-center justify-center rounded-[6px] bg-cream p-4 text-center text-[12px] leading-[1.6] text-muted">
          Chart unavailable: the charting library could not load. {label}
        </p>
      ) : null}
    </div>
  );
}
