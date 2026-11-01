import { NextResponse, type NextRequest } from 'next/server';

import { contentSecurityPolicy, newNonce } from '@/lib/security-headers';

/* A fresh CSP nonce for each page request (decision 0028, D66). Next.js finds the nonce in
   the request's Content-Security-Policy header and adds it to the scripts it renders, which
   is why the root layout renders every page per request. This is not access control: the
   pages are guarded by FastAPI (decisions 0024, 0026). */
export function proxy(request: NextRequest) {
  const policy = contentSecurityPolicy(newNonce(), { development: process.env.NODE_ENV === 'development' });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('Content-Security-Policy', policy);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', policy);
  return response;
}

export const config = {
  matcher: [
    {
      // Pages only: not /api (FastAPI sends its own headers) or Next.js's static files
      source: '/((?!api/|_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
