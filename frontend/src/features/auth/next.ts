import { safeNext } from '@/lib/redirects';

export type NextProps = { searchParams: Promise<{ next?: string | string[] }> };

/** The page's `next`, if it's a page of this site (decision 0024, D44) */
export async function nextOf({ searchParams }: NextProps) {
  const next = (await searchParams).next;
  return safeNext(typeof next === 'string' ? next : null);
}
