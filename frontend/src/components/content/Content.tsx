import Link from 'next/link';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/* Building blocks of the long-form pages (Methodology, About), from their style.css sections.
   Gold text on light surfaces is gold-ink, and no text is under 10px (decision 0017). */

/** Small mono label above a heading (.meth-eyebrow, .about-section-eyebrow) */
export function Eyebrow({ children, onDark = false }: { children: ReactNode; onDark?: boolean }) {
  return (
    <p
      className={cn(
        'mb-2 font-mono text-[10px] uppercase tracking-[0.18em]',
        onDark ? 'text-gold' : 'text-gold-ink',
      )}
    >
      {children}
    </p>
  );
}

/** Body paragraph (.meth-p, .about-p) */
export function Paragraph({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('mb-3.5 text-[14px] leading-[1.8] text-ink/80', className)}>{children}</p>;
}

const TONES = {
  amber: { border: 'border-l-gold', term: 'text-gold-ink' },
  green: { border: 'border-l-green', term: 'text-green' },
  red: { border: 'border-l-red', term: 'text-red' },
} as const;

export type Tone = keyof typeof TONES;

/** A term and its definition with a coloured edge (.meth-concept-card) */
export function ConceptCard({ term, tone, children }: { term: string; tone: Tone; children: ReactNode }) {
  return (
    <div
      className={cn(
        'mb-3 rounded-r-[6px] border-[0.5px] border-l-[3px] border-navy/10 bg-white px-[18px] py-4',
        TONES[tone].border,
      )}
    >
      <p className={cn('mb-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.08em]', TONES[tone].term)}>
        {term}
      </p>
      <p className="text-[13px] leading-[1.7] text-ink/80">{children}</p>
    </div>
  );
}

/** Gold call-to-action link for dark surfaces (.meth-cta-btn) */
export function GoldLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-block whitespace-nowrap rounded-md bg-gold px-6 py-3 text-[13px] font-medium text-navy transition-colors hover:bg-gold-hover',
        className,
      )}
    >
      {children}
    </Link>
  );
}
