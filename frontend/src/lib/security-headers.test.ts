import { contentSecurityPolicy, newNonce, staticSecurityHeaders } from './security-headers';

describe('contentSecurityPolicy', () => {
  it('runs only scripts carrying this response’s nonce, and loads nothing from elsewhere', () => {
    const policy = contentSecurityPolicy('abc123');
    expect(policy).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(policy).not.toContain('unsafe-eval');
    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).not.toMatch(/https?:/);
  });

  it('allows inline styles without a style nonce, which would switch them off', () => {
    const styles = contentSecurityPolicy('abc123').split('; ').find((d) => d.startsWith('style-src'));
    expect(styles).toBe("style-src 'self' 'unsafe-inline'");
  });

  it('adds eval only in development', () => {
    expect(contentSecurityPolicy('n', { development: true })).toContain("'unsafe-eval'");
  });
});

describe('newNonce', () => {
  it('is different every time', () => {
    expect(newNonce()).not.toBe(newNonce());
  });
});

describe('staticSecurityHeaders', () => {
  it('sends nosniff, no framing and a referrer policy', () => {
    const headers = Object.fromEntries(staticSecurityHeaders.map((h) => [h.key, h.value]));
    expect(headers).toMatchObject({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    });
  });
});
