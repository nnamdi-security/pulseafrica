import { IconFlask } from '@tabler/icons-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/** Says that figures include seeded, simulated responses (METH-01, decision 0004) */
export function DemoNotice({ children, dark = false, className }: { children: ReactNode; dark?: boolean; className?: string }) {
  return (
    <p
      role="note"
      className={cn(
        'flex items-start gap-2.5 rounded-[6px] border border-gold/35 leading-[1.6]',
        dark ? 'bg-gold/10 px-3 py-2.5 text-[12px] text-white/75' : 'bg-gold/8 px-4 py-3 text-[13px] text-navy',
        className,
      )}
    >
      <IconFlask aria-hidden="true" size={16} className={cn('mt-0.5 shrink-0', dark ? 'text-gold' : 'text-gold-ink')} />
      <span>{children}</span>
    </p>
  );
}

/** The bold lead-in of a notice */
export function NoticeLead({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return <strong className={cn('font-medium', dark ? 'text-gold' : 'text-gold-ink')}>{children}</strong>;
}
