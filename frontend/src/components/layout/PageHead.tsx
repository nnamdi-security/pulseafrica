import type { ReactNode } from 'react';

/** The navy band that opens every inner page (style.css .page-head) */
export function PageHead({
  label,
  title,
  children,
  extra,
}: {
  label: string;
  title: string;
  children?: ReactNode;
  /** Below the sub-line, at full width (the Polls page's figures) */
  extra?: ReactNode;
}) {
  return (
    <section className="bg-navy px-10 pt-12 pb-[52px] tablet:px-6 tablet:pt-9 tablet:pb-10" aria-labelledby="page-title">
      <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-gold">{label}</p>
      <h1
        id="page-title"
        tabIndex={-1}
        className="mb-2.5 font-serif text-[36px] leading-[1.1] font-bold tracking-[-0.03em] text-parchment focus:outline-none tablet:text-[28px]"
      >
        {title}
      </h1>
      {children ? <div className="max-w-[440px] text-[14px] leading-[1.7] text-parchment/50">{children}</div> : null}
      {extra}
    </section>
  );
}

/** The figures along the bottom of the Dashboard's and Admin's page heads (style.css
    .page-head-stats); "–" until they arrive */
export function PageHeadStats({ items }: { items: { label: string; value?: ReactNode }[] }) {
  return (
    <div className="mt-7 flex items-center gap-9 tablet:flex-wrap tablet:gap-5 mobile:flex-col mobile:items-start mobile:gap-3.5">
      {items.map((item, i) => (
        <div key={item.label} className="contents">
          {i ? <div aria-hidden="true" className="h-9 w-px bg-gold/20 mobile:hidden" /> : null}
          <div>
            <p className="font-mono text-[24px] leading-none font-bold tracking-[-0.03em] text-parchment">{item.value ?? '–'}</p>
            <p className="mt-[3px] font-mono text-[10px] uppercase tracking-[0.09em] text-parchment/50">{item.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
