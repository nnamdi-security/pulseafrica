import { IconFlask } from '@tabler/icons-react';
import Link from 'next/link';

/* Says on every page that the site is a demonstration with synthetic data (Milestone 9, D63;
   METH-01). Shown when the server runs with DEMO_SITE=true, which render.yaml sets for the
   first deployment; the per-figure "Demonstration data" notices stay as they are. */

/** Read per request (the root layout renders every page per request) */
export function isDemoSite() {
  return process.env.DEMO_SITE === 'true';
}

export function DemoSiteBanner() {
  return (
    <aside
      aria-label="Demonstration site"
      className="flex items-center justify-center gap-2 border-b border-gold/35 bg-gold/8 px-10 py-2 text-center text-[12px] leading-[1.5] text-navy tablet:px-6 tablet:justify-start tablet:text-left"
    >
      <IconFlask aria-hidden="true" size={15} className="shrink-0 text-gold-ink" />
      <p>
        <strong className="font-medium text-gold-ink">Demonstration site.</strong> The nation, polls and responses here
        are fictional or synthetic, made to show how PulseAfrica works; they are not real research.{' '}
        <Link href="/about#project-heading" className="font-medium underline underline-offset-2 hover:text-gold-ink">
          About the project
        </Link>
      </p>
    </aside>
  );
}
