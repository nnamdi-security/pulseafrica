import { legacyRedirects, routeForHash, routeForLegacyPage, safeNext } from './redirects';

describe('legacyRedirects', () => {
  it('covers every old page, temporarily', () => {
    const sources = new Set(legacyRedirects.map((r) => r.source));
    for (const page of ['index', 'polls', 'poll', 'results', 'methodology', 'about', 'login', 'dashboard', 'admin']) {
      expect(sources).toContain(`/${page}.html`);
    }
    expect(legacyRedirects.every((r) => r.permanent === false)).toBe(true);
  });

  it('sends poll and results links with an id to that poll before the id-less fallback', () => {
    const poll = legacyRedirects.filter((r) => r.source === '/poll.html');
    expect(poll.map((r) => r.destination)).toEqual(['/polls/:id', '/polls']);
    expect(poll[0]!.has).toEqual([{ type: 'query', key: 'id', value: '(?<id>\\d+)' }]);
    const results = legacyRedirects.filter((r) => r.source === '/results.html');
    expect(results.map((r) => r.destination)).toEqual(['/results/:id', '/results']);
  });
});

describe('routeForHash', () => {
  it.each([
    ['/dashboard', '#history', '/dashboard/history'],
    ['/dashboard', '#settings', '/dashboard/settings'],
    ['/admin', '#polls', '/admin/polls'],
    ['/admin', '#users', '/admin/users'],
    ['/login', '#register', '/register'],
    ['/login', '#reset', '/login/reset'],
  ])('%s%s → %s', (path, hash, target) => {
    expect(routeForHash(path, hash)).toBe(target);
  });

  it('leaves other hashes alone', () => {
    expect(routeForHash('/dashboard', '')).toBeNull();
    expect(routeForHash('/methodology', '#faq')).toBeNull();
    expect(routeForHash('/', '#settings')).toBeNull();
  });
});

describe('routeForLegacyPage', () => {
  it.each([
    ['index.html', '/'],
    ['poll.html?id=3', '/polls/3'],
    ['poll.html', '/polls'],
    ['poll.html?id=abc', '/polls'],
    ['results.html?id=12', '/results/12'],
    ['results.html', '/results'],
    ['dashboard.html', '/dashboard'],
    ['ADMIN.html', '/admin'],
    ['polls.html?category=economy', '/polls'],
  ])('%s → %s', (page, target) => {
    expect(routeForLegacyPage(page)).toBe(target);
  });

  it('rejects anything that is not one of the old pages', () => {
    for (const page of ['evil.html', 'https://evil.example/poll.html', '../poll.html', 'poll.htm', '']) {
      expect(routeForLegacyPage(page)).toBeNull();
    }
  });
});

describe('safeNext', () => {
  it('accepts internal paths', () => {
    expect(safeNext('/polls/3')).toBe('/polls/3');
    expect(safeNext('/results/3?tab=trend')).toBe('/results/3?tab=trend');
  });

  it('maps old next values from sign-in links', () => {
    expect(safeNext('poll.html?id=3')).toBe('/polls/3');
  });

  it('never leads to another site', () => {
    for (const next of ['//evil.example', '/\\evil.example', 'https://evil.example', 'javascript:alert(1)', '/ /x', null, undefined, '']) {
      expect(safeNext(next)).toBeNull();
    }
  });
});
