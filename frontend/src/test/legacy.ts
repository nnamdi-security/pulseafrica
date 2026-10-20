/* Runs functions from the static pages' inline scripts, so ported logic can be tested against
   what the current pages actually compute ("today's outputs as expected values"). */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';

const ROOT = join(__dirname, '..', '..', '..');

/** The source of `function name(…) {…}` in a page, found by matching braces */
function functionSource(html: string, name: string) {
  const start = html.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`${name} not found`);
  let depth = 0;
  for (let i = html.indexOf('{', start); i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}' && --depth === 0) return html.slice(start, i + 1);
  }
  throw new Error(`${name} has unbalanced braces`);
}

/** The named functions from a static page, evaluated together so they can call each other */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped code from the static pages
type Legacy = (...args: any[]) => any;

export function legacyFunctions<N extends string>(page: string, names: N[], globals: Record<string, unknown> = {}) {
  const html = readFileSync(join(ROOT, page), 'utf8');
  const source = names.map((name) => functionSource(html, name)).join('\n');
  const sandbox: Record<string, unknown> = { ...globals };
  runInNewContext(`${source}\nthis.exports = { ${names.join(', ')} };`, sandbox);
  return sandbox.exports as Record<N, Legacy>;
}

/** The theme's colours by value (globals.css), to translate the static pages' literal colours */
export const HEX_TO_TOKEN: Record<string, string> = Object.fromEntries(
  [...readFileSync(join(__dirname, '..', 'styles', 'globals.css'), 'utf8').matchAll(/--color-([a-z-]+):\s*(#[0-9a-f]{6});/gi)].map(
    (m) => [m[2]!.toLowerCase(), m[1]!],
  ),
);
export const token = (hex: string) => HEX_TO_TOKEN[hex.toLowerCase()] ?? `not a theme colour: ${hex}`;
