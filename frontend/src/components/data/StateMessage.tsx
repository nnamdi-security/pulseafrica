import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/** A loading, empty or error message where a list would be (style.css .home-state, .polls-state) */
export function StateMessage({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'col-span-full rounded-lg border-[0.5px] border-dashed border-navy/18 bg-white px-6 py-10 text-center text-[13px] text-muted [&_a]:underline [&_a]:underline-offset-2',
        className,
      )}
    >
      {children}
    </div>
  );
}
