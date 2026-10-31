/* admin.html's buttons, badges and tables (style.css .admin-*) */
import { cn } from '@/lib/utils';

import { STATUS_LABEL, type PollStatus } from './data';

export const BUTTON =
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-navy/18 bg-white px-3.5 py-2 text-[13px] font-medium text-navy transition-colors hover:enabled:border-gold hover:enabled:text-gold-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:cursor-not-allowed disabled:opacity-45';
export const BUTTON_PRIMARY = cn(BUTTON, 'border-navy bg-navy text-parchment hover:enabled:bg-navy-hover hover:enabled:text-parchment hover:enabled:border-navy');
export const BUTTON_DANGER = cn(BUTTON, 'border-red bg-red text-white hover:enabled:border-red-dark hover:enabled:bg-red-dark hover:enabled:text-white');

/** .admin-btn on a link, which has no :enabled state */
export const LINK_BUTTON = cn(BUTTON, 'hover:border-gold hover:text-gold-ink');

/** .admin-btn-sm, .admin-btn-icon and .admin-btn-danger-ghost */
export const SMALL = 'px-2.5 py-[5px] text-[12px]';
export const ICON_ONLY = 'px-2 py-[5px]';
export const DANGER_GHOST = 'text-red hover:enabled:border-red hover:enabled:text-red-dark';

/** .admin-input: the editor's question and option fields, and the users toolbar */
export const INPUT =
  'min-w-0 rounded-md border border-navy/18 bg-white px-2.5 py-2 text-[13px] leading-[normal] text-navy placeholder:text-faint focus:border-gold focus:ring-3 focus:ring-gold/15 focus:outline-none aria-invalid:border-red';

export const TABLE_WRAP = 'relative mt-3.5 overflow-x-auto';
export const TABLE = 'w-full border-collapse text-[13px]';
export const TH = 'whitespace-nowrap border-b border-navy/10 pr-3 pb-2.5 text-left font-mono text-[10px] font-normal uppercase tracking-[0.12em] text-muted';
export const TD = 'border-b border-navy/6 py-3 pr-3 align-middle text-slate';
export const NUM = 'text-right font-mono tabular-nums';

const STATUS_COLOUR: Record<PollStatus, string> = { active: 'text-green', draft: 'text-gold-ink', closed: 'text-muted' };

function Dot({ label, colour }: { label: string; colour: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap font-mono text-[10px]', colour)}>
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

/** Draft, Live or Closed: always a word, never colour alone */
export function StatusBadge({ status }: { status: PollStatus }) {
  return <Dot label={STATUS_LABEL[status]} colour={STATUS_COLOUR[status]} />;
}

/** A user's Active or Suspended */
export function UserStatus({ active }: { active: boolean }) {
  return active ? <Dot label="Active" colour="text-green" /> : <Dot label="Suspended" colour="text-red" />;
}

/** .admin-role: Admin or Citizen (9px in style.css; 10px here, FE-03) */
export function RoleBadge({ role }: { role: 'admin' | 'citizen' }) {
  return (
    <span
      className={cn(
        'whitespace-nowrap rounded-[3px] px-2 py-[3px] font-mono text-[10px] uppercase tracking-[0.08em]',
        role === 'admin' ? 'bg-gold/14 text-gold-ink' : 'bg-navy/6 text-slate',
      )}
    >
      {role === 'admin' ? 'Admin' : 'Citizen'}
    </span>
  );
}
