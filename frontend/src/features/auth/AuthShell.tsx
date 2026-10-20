'use client';

/* login.html's frame, shared by /login, /register and /login/reset (decision 0024, D43): the
   trust panel, and the card with its "Sign in / Create account" tabs. The tabs are links
   between the two routes and keep the `next` parameter.

   The card swaps its form for the success panel after a sign-in without `next` (D44). A link
   inside the card that moves to another view asks that view to take focus when it arrives,
   as login.html's view links do. */
import { IconCheck, IconLock, IconMapPin, IconUserCheck } from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { createContext, Suspense, useContext, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';

import { FOCUS_RING, SUBMIT } from '@/components/forms/Fields';
import { useStats } from '@/lib/api/queries';
import { cn } from '@/lib/utils';

export type Success = { title: string; text: string; meta: string };

/** Which field a view focuses when a link inside the card brought the user there */
export type ArriveFocus = 'first' | 'password' | null;

type AuthContextValue = {
  showSuccess: (success: Success) => void;
  /** Asks the next view to take focus when it arrives */
  arriveWith: (focus: ArriveFocus) => void;
  /** What the arriving view should focus, once */
  takeArrive: () => ArriveFocus;
  /** The email typed into Create account, carried to Sign in by "Sign in instead" */
  email: string;
  setEmail: (email: string) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuthShell() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuthShell outside AuthShell');
  return value;
}

/** A link inside the card to another view, which takes focus when it arrives */
export function ViewLink({
  href,
  focus = 'first',
  className,
  onClick,
  children,
}: {
  href: string;
  focus?: ArriveFocus;
  className?: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  const { arriveWith } = useAuthShell();
  const search = useSearchParams();
  const next = search.get('next');
  return (
    <Link href={next ? `${href}?next=${encodeURIComponent(next)}` : href} className={className} onClick={() => {
        arriveWith(focus);
        onClick?.();
      }}
    >
      {children}
    </Link>
  );
}

/** Focuses `target` on arrival when a ViewLink asked for it */
export function useArriveFocus(targets: Partial<Record<Exclude<ArriveFocus, null>, RefObject<HTMLElement | null>>>) {
  const { takeArrive } = useAuthShell();
  useEffect(() => {
    const want = takeArrive();
    if (want) targets[want]?.current?.focus();
    // Once, on arrival
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

const POINTS = [
  {
    Icon: IconUserCheck,
    title: 'One response per person',
    text: 'Each account can answer a poll once, so every poll counts one response per person.',
  },
  {
    Icon: IconLock,
    title: 'Published only as totals',
    text: "Your answers are stored with your account so you're counted once. We publish only aggregate results.",
  },
  {
    Icon: IconMapPin,
    title: 'Results by state and age',
    text: 'Your state and age range let us break results down across all 40 states. Weighting is planned.',
  },
];

/** The platform's own figures (login.html's were fixed numbers; decision 0025) */
function AsideStats() {
  const { data: stats } = useStats();
  const items = [
    { label: 'Registered voices', value: stats?.registeredUsers.toLocaleString() },
    { label: 'States covered', value: stats?.statesCovered.toLocaleString() },
    { label: 'Live polls', value: stats?.activePolls.toLocaleString() },
  ];
  return (
    <div className="mt-auto grid grid-cols-3 border-t border-gold/20 pt-[22px] mobile:gap-3">
      {items.map((item) => (
        <div key={item.label} className="flex flex-col gap-1">
          <span className="font-mono text-[20px] font-bold text-gold mobile:text-[17px]">{item.value ?? '–'}</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-parchment/60 mobile:tracking-[0.08em]">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function Aside() {
  return (
    <aside
      aria-label="Why create an account"
      className="relative flex flex-col gap-7 bg-navy px-12 py-[52px] text-parchment before:absolute before:inset-x-0 before:top-0 before:h-[3px] before:bg-gold tablet:p-9 mobile:px-5 mobile:py-8"
    >
      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-gold">Your voice, on the record</div>
      <h1 className="-mt-3.5 font-serif text-[34px]/[1.15] font-bold tracking-[-0.02em] tablet:text-[28px]/[1.15]">
        One citizen.
        <br />
        One account.
        <em className="block font-normal text-gold italic">One honest response.</em>
      </h1>
      <p className="text-[14px] leading-[1.7] text-parchment/70">
        An account lets us guarantee one response per citizen per poll — the foundation of every number we publish. Your answers are stored with
        your account, and are only ever published as totals.
      </p>
      <ul className="flex flex-col gap-[18px]">
        {POINTS.map(({ Icon, title, text }) => (
          <li key={title} className="flex items-start gap-3.5">
            <div aria-hidden="true" className="flex size-[34px] shrink-0 items-center justify-center rounded-[6px] border border-gold/30 bg-gold/12 text-gold">
              <Icon size={17} />
            </div>
            <div>
              <h2 className="mb-0.5 text-[14px] font-medium text-parchment">{title}</h2>
              <p className="text-[12.5px] leading-[1.6] text-parchment/60">{text}</p>
            </div>
          </li>
        ))}
      </ul>
      <AsideStats />
    </aside>
  );
}

const TABS = [
  { href: '/login', label: 'Sign in', id: 'tab-login' },
  { href: '/register', label: 'Create account', id: 'tab-register' },
] as const;

function Tabs() {
  const pathname = usePathname();
  const router = useRouter();
  const next = useSearchParams().get('next');
  const refs = useRef<(HTMLAnchorElement | null)[]>([]);
  const query = next ? `?next=${encodeURIComponent(next)}` : '';
  return (
    <div role="tablist" aria-label="Sign in or create account" className="mb-[30px] grid grid-cols-2 rounded-[6px] border border-navy/8 bg-cream p-1">
      {TABS.map((tab, i) => {
        const selected = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            ref={(el) => {
              refs.current[i] = el;
            }}
            id={tab.id}
            href={tab.href + query}
            role="tab"
            aria-selected={selected}
            aria-controls="auth-view"
            tabIndex={selected ? 0 : -1}
            onKeyDown={(e) => {
              // Arrow keys move between the two tabs, as on login.html
              if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
              e.preventDefault();
              const other = TABS[1 - i]!;
              router.push(other.href + query);
              refs.current[1 - i]?.focus();
            }}
            className={cn(
              'rounded-sm px-3 py-[9px] text-center text-[13px] font-medium transition-colors',
              selected ? 'bg-navy text-parchment' : 'text-muted hover:text-navy',
              FOCUS_RING,
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}

function SuccessPanel({ success }: { success: Success }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    document.title = 'Success — PulseAfrica';
    heading.current?.focus();
  }, []);
  return (
    <div className="pt-7 pb-2 text-center">
      <div
        aria-hidden="true"
        className="mx-auto mb-5 flex size-16 items-center justify-center rounded-full border border-green/25 bg-green/10 text-green motion-safe:animate-auth-pop"
      >
        <IconCheck size={30} />
      </div>
      <h2 ref={heading} tabIndex={-1} className="mb-1 font-serif text-[26px] font-semibold tracking-[-0.01em] text-navy outline-none mobile:text-[23px]">
        {success.title}
      </h2>
      <p className="mx-auto max-w-[380px] text-[13.5px] leading-[1.6] text-muted">{success.text}</p>
      <div className="mt-4 inline-block rounded-sm border border-green/20 bg-green/7 px-3 py-1.5 font-mono text-[11px] break-all text-green">{success.meta}</div>
      <div className="mx-auto mt-7 flex max-w-[320px] flex-col gap-2.5">
        <Link href="/polls" className={cn(SUBMIT, 'mt-0')}>
          <span>Browse live polls</span>
        </Link>
      </div>
    </div>
  );
}

/** The card's content: the view, or the success panel once a form succeeded */
function Card({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [success, setSuccess] = useState<{ path: string; value: Success } | null>(null);
  const arrive = useRef<ArriveFocus>(null);
  const [email, setEmail] = useState('');
  // The panel belongs to the view that showed it: moving to another view leaves it
  const shown = success && success.path === pathname ? success.value : null;
  const context: AuthContextValue = {
    showSuccess: (value) => setSuccess({ path: pathname, value }),
    arriveWith: (focus) => {
      arrive.current = focus;
    },
    takeArrive: () => {
      const focus = arrive.current;
      arrive.current = null;
      return focus;
    },
    email,
    setEmail,
  };
  return (
    <AuthContext.Provider value={context}>
      <section aria-label="Account access" className="px-12 pt-10 pb-11 tablet:order-first tablet:px-9 tablet:pt-9 tablet:pb-10 mobile:px-5 mobile:pt-7 mobile:pb-9">
        {shown || pathname === '/login/reset' ? null : (
          <Suspense>
            <Tabs />
          </Suspense>
        )}
        {shown ? (
          <SuccessPanel success={shown} />
        ) : (
          <div id="auth-view" role={pathname === '/login/reset' ? undefined : 'tabpanel'} aria-labelledby={pathname === '/login/reset' ? undefined : pathname === '/register' ? 'tab-register' : 'tab-login'}>
            {children}
          </div>
        )}
      </section>
    </AuthContext.Provider>
  );
}

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="bg-parchment px-10 pt-14 pb-[72px] tablet:px-6 tablet:pt-8 tablet:pb-14 mobile:bg-white mobile:p-0">
      <div className="mx-auto grid max-w-[1080px] grid-cols-[1fr_1.05fr] overflow-hidden rounded-xl bg-white shadow-[0_18px_48px_color-mix(in_srgb,var(--color-navy)_12%,transparent)] tablet:max-w-[560px] tablet:grid-cols-1 mobile:rounded-none mobile:shadow-none">
        <Aside />
        <Card>{children}</Card>
      </div>
    </div>
  );
}

/** "Sign in" / "Create account" headings and their line */
export function ViewHead({ title, sub, headingRef }: { title: string; sub: string; headingRef?: RefObject<HTMLHeadingElement | null> }) {
  return (
    <div className="mb-[22px]">
      <h2
        ref={headingRef}
        tabIndex={headingRef ? -1 : undefined}
        className="mb-1 font-serif text-[26px] font-semibold tracking-[-0.01em] text-navy outline-none mobile:text-[23px]"
      >
        {title}
      </h2>
      <p className="text-[13.5px] leading-[1.6] text-muted">{sub}</p>
    </div>
  );
}

/** "New to PulseAfrica? Create an account" */
export function SwitchLine({ children }: { children: ReactNode }) {
  return <p className="mt-[22px] text-center text-[13px] text-muted [&_a]:font-medium [&_a]:text-green [&_a]:hover:text-gold-ink">{children}</p>;
}
