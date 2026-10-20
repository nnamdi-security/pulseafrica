'use client';

import { useReference } from '@/lib/api/queries';
import { cn } from '@/lib/utils';

/* Category colours (style.css .cat-*); unknown categories look like governance, as
   ticker.js's categoryKey() does */
const STYLES: Record<string, string> = {
  presidency: 'bg-navy/6 text-navy',
  governors: 'bg-navy/6 text-navy',
  economy: 'bg-gold/10 text-gold-ink',
  security: 'bg-green/10 text-green-ink',
  education: 'bg-indigo/10 text-indigo-ink',
  healthcare: 'bg-red/8 text-red-ink',
  governance: 'bg-muted/10 text-slate',
};

/** A category's display name from GET /api/reference, or its key capitalised until that arrives */
export function useCategoryName() {
  const { data } = useReference();
  return (key: string) =>
    data?.categories.find((c) => c.key === key)?.name ?? (key ? key.charAt(0).toUpperCase() + key.slice(1) : 'Poll');
}

export function CategoryBadge({ category, suffix, className }: { category: string; suffix?: string; className?: string }) {
  const name = useCategoryName();
  return (
    <span
      className={cn(
        'inline-block rounded-xs px-[9px] py-[3px] font-mono text-[10px] uppercase tracking-[0.12em]',
        STYLES[category] ?? STYLES.governance,
        className,
      )}
    >
      {name(category)}
      {suffix}
    </span>
  );
}
