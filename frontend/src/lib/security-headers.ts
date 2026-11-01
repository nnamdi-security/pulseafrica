/* Security headers for every page of frontend/ (decision 0028, D66; SEC-07).

   The Content-Security-Policy carries a fresh nonce per request, set in src/proxy.ts; Next.js
   reads it from the request's CSP header and puts it on its own scripts, so only the scripts it
   rendered run. Styles allow 'unsafe-inline' because React writes style attributes (bar widths,
   the ticker's speed), which nonces can't cover; there's no nonce in style-src, since a nonce
   would switch 'unsafe-inline' off. Fonts are self-hosted by next/font, so everything is 'self'.

   The API's own responses (/api/*) keep the headers FastAPI sets (app/main.py). */

/** The policy for one page response */
export function contentSecurityPolicy(nonce: string, { development = false } = {}) {
  return [
    "default-src 'self'",
    // React uses eval only in development, for its error overlay
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

/** A random nonce, base64 */
export function newNonce() {
  return btoa(crypto.randomUUID());
}

/** Headers sent with every page and asset, set in next.config.ts */
export const staticSecurityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  // Browsers ignore HSTS over plain http, so it's harmless locally. No includeSubDomains:
  // the first deployment lives on a platform's shared domain (D62).
  { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
];
