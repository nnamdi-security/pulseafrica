'use client';

import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

/** Sticky "Jump to section" list that highlights the section in view (methodology.html's scroll spy) */
export function SectionNav({ sections }: { sections: { id: string; label: string }[] }) {
  const [active, setActive] = useState(sections[0]?.id);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) if (entry.isIntersecting) setActive(entry.target.id);
      },
      { rootMargin: '-20% 0px -70% 0px' },
    );
    for (const { id } of sections) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [sections]);

  return (
    <nav
      aria-label="Jump to section"
      className="sticky top-16 h-[calc(100vh-64px)] self-start overflow-y-auto border-r border-navy/10 bg-white py-7 tablet:static tablet:flex tablet:h-auto tablet:flex-wrap tablet:border-r-0 tablet:border-b tablet:py-4"
    >
      <p className="mb-3 px-[22px] font-mono text-[10px] uppercase tracking-[0.15em] text-muted tablet:mb-1.5 tablet:w-full">
        Sections
      </p>
      {sections.map(({ id, label }) => (
        <a
          key={id}
          href={`#${id}`}
          aria-current={active === id ? 'true' : undefined}
          onClick={() => setActive(id)}
          className={cn(
            'block border-l-2 border-transparent px-[22px] py-[9px] text-[12px] text-muted transition-colors hover:bg-navy/3 hover:text-navy',
            'tablet:border-b-2 tablet:border-l-0 tablet:px-3.5 tablet:py-2 tablet:text-[11px] tablet:whitespace-nowrap',
            active === id && 'border-l-gold bg-gold/4 font-medium text-navy tablet:border-b-gold',
          )}
        >
          {label}
        </a>
      ))}
    </nav>
  );
}
