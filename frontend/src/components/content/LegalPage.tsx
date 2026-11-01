import type { ReactNode } from 'react';

import { Eyebrow, Paragraph } from './Content';
import { SectionNav } from './SectionNav';

/* The Privacy and Terms pages (Milestone 9, D64; FE-05): Methodology's hero and section
   layout, with plain sections. The copy must match what the code does (PRIV-02): check the
   models and routes before changing a sentence. */

/** Where people write about their data or these terms (the owner's choice, 2026-11-01) */
export const CONTACT_EMAIL = 'olivetgrail@gmail.com';

export const UPDATED = '1 November 2026';

export type LegalSection = { id: string; label: string; title: string; body: ReactNode };

export function LegalPage({
  eyebrow,
  title,
  intro,
  sections,
}: {
  eyebrow: string;
  title: string;
  intro: ReactNode;
  sections: LegalSection[];
}) {
  return (
    <>
      <section className="border-b-2 border-gold bg-navy px-10 pt-11 pb-[52px] tablet:px-6 tablet:pt-8 tablet:pb-10">
        <Eyebrow onDark>{eyebrow}</Eyebrow>
        <h1 className="mb-3 font-serif text-[34px] leading-[1.1] font-bold tracking-[-0.03em] text-parchment tablet:text-[26px]">
          {title}
        </h1>
        <p className="max-w-[540px] text-[14px] leading-[1.75] text-parchment/55">{intro}</p>
        <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.12em] text-parchment/55">Last updated {UPDATED}</p>
      </section>

      <div className="grid min-h-[70vh] grid-cols-[210px_1fr] bg-cream tablet:grid-cols-1">
        <SectionNav sections={sections.map(({ id, label }) => ({ id, label }))} />
        <div className="max-w-[760px] px-12 pt-11 pb-16 tablet:px-6 tablet:pt-8 tablet:pb-12">
          {sections.map(({ id, title: heading, body }, i) => (
            <section key={id} id={id} aria-labelledby={`heading-${id}`} className="mb-12 scroll-mt-6 last:mb-0">
              <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-gold-ink">
                {String(i + 1).padStart(2, '0')}
              </p>
              <h2
                id={`heading-${id}`}
                className="mb-4 font-serif text-[26px] leading-[1.2] font-bold tracking-[-0.025em] text-navy"
              >
                {heading}
              </h2>
              {body}
            </section>
          ))}
        </div>
      </div>
    </>
  );
}

/** A bulleted list in a legal section */
export function LegalList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="mb-3.5 list-disc space-y-2 pl-5 text-[14px] leading-[1.8] text-ink/80 marker:text-gold-ink">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

export { Paragraph };
