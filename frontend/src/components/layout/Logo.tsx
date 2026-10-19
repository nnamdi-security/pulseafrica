import Link from 'next/link';

/** PulseAfrica wordmark (style.css .logo), used in the nav and the footer */
export function Logo() {
  return (
    <Link href="/" className="flex items-baseline gap-1.5" aria-label="PulseAfrica home">
      <span className="font-serif text-[22px] font-bold tracking-[-0.02em] text-parchment">Pulse</span>
      <span className="mb-0.5 block size-1 rounded-full bg-gold" aria-hidden="true" />
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-gold">Africa</span>
    </Link>
  );
}
