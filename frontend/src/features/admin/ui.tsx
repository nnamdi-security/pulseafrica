/* admin.html's buttons, badges and tables (style.css .admin-*) */
import { cn } from '@/lib/utils';

import { STATUS_LABEL, type PollStatus } from './data';

export const BUTTON =
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-navy/18 bg-white px-3.5 py-2 text-[13px] font-medium text-navy transition-colors hover:enabled:border-gold hover:enabled:text-gold-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:cursor-not-allowed disabled:opacity-45';
export const BUTTON_PRIMARY = cn(BUTTON, 'border-navy bg-navy text-parchment hover:enabled:bg-navy-hover hover:enabled:text-parchment hover:enabled:border-navy');
export const BUTTON_DANGER = cn(BUTTON, 'border-red bg-red text-white hover:enabled:border-red-dark hover:enabled:bg-red-dark hover:enabled:text-white');

export const TABLE_WRAP = 'relative mt-3.5 overflow-x-auto';
export const TABLE = 'w-full border-collapse text-[13px]';
export const TH = 'whitespace-nowrap border-b border-navy/10 pr-3 pb-2.5 text-left font-mono text-[10px] font-normal uppercase tracking-[0.12em] text-muted';
export const TD = 'border-b border-navy/6 py-3 pr-3 align-middle text-slate';
export const NUM = 'text-right font-mono tabular-nums';

const STATUS_COLOUR: Record<PollStatus, string> = { active: 'text-green', draft: 'text-gold-ink', closed: 'text-muted' };

/** Draft, Live or Closed: always a word, never colour alone */
export function StatusBadge({ status }: { status: PollStatus }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap font-mono text-[10px]', STATUS_COLOUR[status])}>
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {STATUS_LABEL[status]}
    </span>
  );
}
