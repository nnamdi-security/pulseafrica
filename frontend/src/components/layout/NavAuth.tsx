'use client';

import { IconUserCircle } from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

import { useMe, useSignOut } from '@/lib/api/queries';
import { cn } from '@/lib/utils';

const LINK = 'text-[13px] font-medium tracking-[0.02em] text-parchment/65 hover:text-parchment focus-visible:text-parchment';
const ACTIVE = 'text-gold hover:text-gold';

/** The nav's sign-in slot (nav-auth.js): "Sign in", or the user's first name, Admin for admins, and Sign out */
export function NavAuth({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { data: user } = useMe();
  const signOut = useSignOut();
  const signInLink = useRef<HTMLAnchorElement>(null);
  const focusAfterSignOut = useRef(false);

  // After signing out, focus lands on the "Sign in" link that replaces the button
  useEffect(() => {
    if (!user && focusAfterSignOut.current) {
      focusAfterSignOut.current = false;
      signInLink.current?.focus();
    }
  }, [user]);

  if (!user) {
    const active = pathname === '/login';
    return (
      <li>
        <Link
          ref={signInLink}
          href="/login"
          className={cn(LINK, active && ACTIVE)}
          aria-current={active ? 'page' : undefined}
          onClick={onNavigate}
        >
          Sign in
        </Link>
      </li>
    );
  }

  const firstName = user.fullName.trim().split(/\s+/)[0];
  const onDashboard = pathname.startsWith('/dashboard');
  const onAdmin = pathname.startsWith('/admin');

  return (
    <li className="flex items-center gap-3.5">
      {user.role === 'admin' ? (
        <Link
          href="/admin"
          className={cn(LINK, onAdmin && ACTIVE)}
          aria-current={onAdmin ? 'page' : undefined}
          onClick={onNavigate}
        >
          Admin
        </Link>
      ) : null}
      <Link
        href="/dashboard"
        title={`Signed in as ${user.email} — your dashboard`}
        className={cn(
          'inline-flex max-w-[140px] items-center gap-1.5 overflow-hidden text-[13px] font-medium tracking-[0.02em] text-ellipsis whitespace-nowrap text-parchment hover:text-gold focus-visible:text-gold',
          onDashboard && 'text-gold',
        )}
        aria-current={onDashboard ? 'page' : undefined}
        onClick={onNavigate}
      >
        <IconUserCircle size={16} className="shrink-0 text-gold" aria-hidden="true" />
        <span className="sr-only">Your dashboard, signed in as </span>
        {firstName}
      </Link>
      <button
        type="button"
        className={LINK}
        disabled={signOut.isPending}
        onClick={() => {
          focusAfterSignOut.current = true;
          signOut.mutate();
        }}
      >
        Sign out
      </button>
    </li>
  );
}
