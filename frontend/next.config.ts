import type { NextConfig } from 'next';

import { legacyRedirects } from './src/lib/redirects';

/* Where FastAPI's /api lives, as seen from the Next.js server. The browser only ever calls
   same-origin /api/*, which is proxied there, so the session cookie is first-party and no
   CORS is needed. Read at build time: set it before `pnpm build`. */
const API_INTERNAL_URL = (process.env.API_INTERNAL_URL ?? 'http://localhost:8000/api').replace(/\/$/, '');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API_INTERNAL_URL}/:path*` }];
  },
  async redirects() {
    return legacyRedirects;
  },
};

export default nextConfig;
