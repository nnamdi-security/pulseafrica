'use client';

/* The cards and notices shared by the Dashboard and Admin (style.css .results-card,
   .results-notice), which dashboard.html and admin.html both build on. */
import { IconLoader2, type Icon } from '@tabler/icons-react';
import { useEffect, useRef, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

export const CARD = 'mb-5 min-w-0 rounded-lg border-[0.5px] border-navy/10 bg-white px-6 py-[22px]';
export const CARD_LABEL = 'mb-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-muted';

export type Notice = { Icon: Icon; title: string; text?: ReactNode; warn?: boolean };

/** Loading, signed out, no access or an error, where a page's panels would be */
export function NoticeCard({ notice, focus }: { notice: Notice; focus?: boolean }) {
  const spin = notice.Icon === IconLoader2;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (focus) ref.current?.focus();
  }, [focus]);
  return (
    <div ref={ref} role="status" tabIndex={focus ? -1 : undefined} className={cn(CARD, 'flex items-start gap-3.5 focus:outline-none')}>
      <notice.Icon
        aria-hidden="true"
        size={22}
        className={cn('mt-px shrink-0', notice.warn ? 'text-red' : 'text-gold-ink', spin && 'animate-spin motion-reduce:animate-none')}
      />
      <div>
        <p className="mb-1 font-serif text-[17px] font-semibold text-navy">{notice.title}</p>
        {notice.text ? <div className="text-[13px] leading-[1.6] text-muted [&_a]:text-green [&_a]:underline [&_a]:underline-offset-2">{notice.text}</div> : null}
      </div>
    </div>
  );
}

/** An error message with a "Try again" button */
export function Retry({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <>
      {message}{' '}
      <button
        type="button"
        onClick={onRetry}
        className="ml-1.5 rounded-sm border border-navy/20 px-2.5 py-0.5 text-[12px] font-medium text-navy hover:border-navy/40"
      >
        Try again
      </button>
    </>
  );
}
