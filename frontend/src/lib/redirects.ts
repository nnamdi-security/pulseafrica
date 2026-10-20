/* Old static-page URLs → new routes (FRONTEND_MIGRATION.md §7).

   Three kinds of old link reach the new frontend:
   - paths and query strings (poll.html?id=3): server redirects, used by next.config.ts;
   - hash tabs (dashboard.html#settings): the hash never reaches the server, so the
     browser keeps it across the redirect and LegacyHashRedirect maps it on the client;
   - `next` values from old sign-in links (login.html?next=poll.html%3Fid%3D3).

   The redirects stay temporary (307) until cutover is verified (Milestone 8). The target
   routes are built in Milestones 6–8. */

export type Redirect = {
  source: string;
  destination: string;
  permanent: false;
  has?: { type: 'query'; key: string; value: string }[];
  missing?: { type: 'query'; key: string; value?: string }[];
};

const ID = { type: 'query' as const, key: 'id', value: '(?<id>\\d+)' };

/** Pages whose new route is just the name without .html */
const SIMPLE_PAGES = ['polls', 'methodology', 'about', 'login', 'dashboard', 'admin'] as const;

export const legacyRedirects: Redirect[] = [
  { source: '/index.html', destination: '/', permanent: false },
  // Checked in order: a poll or results link with an id goes to that poll
  { source: '/poll.html', has: [ID], destination: '/polls/:id', permanent: false },
  { source: '/poll.html', destination: '/polls', permanent: false },
  { source: '/results.html', has: [ID], destination: '/results/:id', permanent: false },
  { source: '/results.html', destination: '/results', permanent: false },
  ...SIMPLE_PAGES.map((page) => ({ source: `/${page}.html`, destination: `/${page}`, permanent: false as const })),
];

/** Hash tabs of the old pages → their new routes */
const HASH_ROUTES: Record<string, Record<string, string>> = {
  '/dashboard': { '#history': '/dashboard/history', '#settings': '/dashboard/settings' },
  '/admin': { '#polls': '/admin/polls', '#users': '/admin/users' },
  '/login': { '#register': '/register', '#reset': '/login/reset' },
};

/** Where an old hash link should land, or null to stay put */
export function routeForHash(pathname: string, hash: string): string | null {
  return HASH_ROUTES[pathname]?.[hash] ?? null;
}

/** An old `next` value (as login.html's nextPage() allowed) → its new route, or null */
export function routeForLegacyPage(page: string): string | null {
  const match = /^([a-z0-9_-]+)\.html(?:\?([^#]*))?$/i.exec(page);
  if (!match) return null;
  const name = match[1]!.toLowerCase();
  const id = new URLSearchParams(match[2] ?? '').get('id');
  const withId = id && /^\d+$/.test(id) ? id : null;
  if (name === 'index') return '/';
  if (name === 'poll') return withId ? `/polls/${withId}` : '/polls';
  if (name === 'results') return withId ? `/results/${withId}` : '/results';
  if ((SIMPLE_PAGES as readonly string[]).includes(name)) return `/${name}`;
  return null;
}

/** A safe place to go after signing in: an internal path, or an old page name. Never another site. */
export function safeNext(next: string | null | undefined): string | null {
  if (!next) return null;
  // One leading slash only: "//evil.example" and "/\evil.example" are other sites to a browser
  if (/^\/(?![/\\])/.test(next) && !/[\s\\]/.test(next)) return next;
  return routeForLegacyPage(next);
}
