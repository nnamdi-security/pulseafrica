/* JavaScript budget per route (decision 0018): first-load JavaScript, gzipped, at most BUDGET_KB (below).

     pnpm build && pnpm budget

   Every route `next build` produced is measured, prerendered or dynamic (decision 0021): its
   first-load scripts are the framework's (build-manifest.json) plus every chunk the route's
   client reference manifest lists for its layouts, error and not-found boundaries and page.
   Chunks loaded later with import(), such as the Results charts, aren't first-load and aren't
   counted. For prerendered routes the script checks that this set matches the scripts in the
   page's HTML, so the two ways of counting can't drift apart unnoticed. */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { gzipSync } from 'node:zlib';

// Decision 0018 set 150 KB, below what Next.js and React load on their own (about 172 KB);
// decision 0020 raised it to 250 KB.
const BUDGET_KB = 250;
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const next = join(root, '.next');
const appDir = join(next, 'server', 'app');

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

if (!existsSync(join(next, 'app-path-routes-manifest.json'))) {
  console.error('No build found. Run `pnpm build` first.');
  process.exit(1);
}
const routes = readJson(join(next, 'app-path-routes-manifest.json'));
const build = readJson(join(next, 'build-manifest.json'));
const framework = [...build.polyfillFiles, ...build.rootMainFiles];

/** The chunks a route's client reference manifest names, e.g. for "/polls/[id]/page" */
function routeChunks(entry) {
  const file = join(appDir, entry + '_client-reference-manifest.js');
  const sandbox = { globalThis: {} };
  sandbox.self = sandbox.globalThis;
  runInNewContext(readFileSync(file, 'utf8'), sandbox);
  const manifest = sandbox.globalThis.__RSC_MANIFEST[entry];
  return Object.values(manifest.entryJSFiles).flat();
}

/** The scripts in a prerendered page's HTML, or null for a dynamic route */
function htmlChunks(route) {
  const file = join(appDir, (route === '/' ? '/index' : route) + '.html');
  if (!existsSync(file)) return null;
  const SCRIPT = /<script[^>]*\ssrc="\/_next\/(static\/[^"]+\.js)"|<link[^>]*\sas="script"[^>]*\shref="\/_next\/(static\/[^"]+\.js)"/g;
  return new Set([...readFileSync(file, 'utf8').matchAll(SCRIPT)].map((m) => m[1] ?? m[2]));
}

let failed = false;
const rows = Object.entries(routes).sort(([, a], [, b]) => a.localeCompare(b));
if (!rows.length) {
  console.error('The build has no routes to measure.');
  process.exit(1);
}

for (const [entry, route] of rows) {
  const chunks = new Set([...framework, ...routeChunks(entry)]);
  const html = htmlChunks(route);
  if (html && [...html].some((src) => !chunks.has(src))) {
    console.error(`MISMATCH ${route}: its HTML loads scripts the manifests don't list.`);
    failed = true;
  }
  const bytes = [...chunks].reduce((sum, src) => sum + gzipSync(readFileSync(join(next, src))).length, 0);
  const kb = bytes / 1024;
  const ok = kb <= BUDGET_KB;
  failed ||= !ok;
  const kind = html ? 'static ' : 'dynamic';
  console.log(`${ok ? 'ok  ' : 'OVER'} ${route.padEnd(24)} ${kind} ${kb.toFixed(1).padStart(6)} KB gzipped (${chunks.size} files)`);
}

if (failed) {
  console.error(`\nA route loads more than ${BUDGET_KB} KB of gzipped JavaScript (decision 0020), or couldn't be measured.`);
  process.exit(1);
}
console.log(`\nEvery route is within the ${BUDGET_KB} KB budget.`);
