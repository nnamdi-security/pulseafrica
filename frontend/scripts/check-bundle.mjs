/* JavaScript budget per route (decision 0018): first-load JavaScript, gzipped, at most BUDGET_KB (below).

     pnpm build && pnpm budget

   For every page `next build` prerenders, it reads the HTML, collects the scripts the page
   loads (script tags and script preloads under /_next/static), and adds up their gzipped
   sizes. Routes that can't be prerendered (dynamic pages, from Milestone 6) need adding
   here when they arrive: the script fails if it finds no page at all. */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

// Decision 0018 set 150 KB, below what Next.js and React load on their own (about 172 KB);
// 250 KB is the proposed replacement (decision 0020, waiting on the owner).
const BUDGET_KB = 250;
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const appDir = join(root, '.next', 'server', 'app');
const staticDir = join(root, '.next');

function htmlFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return htmlFiles(path);
    return entry.name.endsWith('.html') ? [path] : [];
  });
}

let pages;
try {
  pages = htmlFiles(appDir);
} catch {
  console.error('No build found. Run `pnpm build` first.');
  process.exit(1);
}
if (!pages.length) {
  console.error('The build has no prerendered pages to measure.');
  process.exit(1);
}

const SCRIPT = /<script[^>]*\ssrc="(\/_next\/static\/[^"]+\.js)"|<link[^>]*\sas="script"[^>]*\shref="(\/_next\/static\/[^"]+\.js)"/g;
let over = false;

for (const page of pages.sort()) {
  const html = readFileSync(page, 'utf8');
  const scripts = new Set([...html.matchAll(SCRIPT)].map((m) => m[1] ?? m[2]));
  const bytes = [...scripts].reduce(
    (sum, src) => sum + gzipSync(readFileSync(join(staticDir, src.replace(/^\/_next\//, '')))).length,
    0,
  );
  const kb = bytes / 1024;
  const route = '/' + relative(appDir, page).replace(/\.html$/, '').replace(/^index$/, '');
  const ok = kb <= BUDGET_KB;
  over ||= !ok;
  console.log(`${ok ? 'ok  ' : 'OVER'} ${route.padEnd(24)} ${kb.toFixed(1).padStart(6)} KB gzipped (${scripts.size} files)`);
}

if (over) {
  console.error(`\nA route loads more than ${BUDGET_KB} KB of gzipped JavaScript (decision 0018).`);
  process.exit(1);
}
console.log(`\nEvery route is within the ${BUDGET_KB} KB budget.`);
