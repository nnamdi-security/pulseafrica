'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { routeForHash } from '@/lib/redirects';

/** Old hash tabs (dashboard.html#settings → /dashboard#settings) move to their own routes */
export function LegacyHashRedirect() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const target = routeForHash(pathname, window.location.hash);
    if (target) router.replace(target);
  }, [pathname, router]);

  return null;
}
