import { afterEach, describe, expect, it } from 'vitest';
import { isCronAuthorized } from '@/lib/pulse/cron-auth';

// Regression tests for Pulse suspect S2: the cron no-secret fallback.
// When CRON_SECRET is unset, authorization must fail closed in production:
// no host-header or X-Forwarded-For based fallback may authorize a caller.

const savedCronSecret = process.env.CRON_SECRET;
const savedNodeEnv = process.env.NODE_ENV;
// NODE_ENV is typed read-only; tests mutate it through this alias.
const env = process.env as Record<string, string | undefined>;

afterEach(() => {
  if (savedCronSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = savedCronSecret;
  if (savedNodeEnv === undefined) delete env.NODE_ENV;
  else env.NODE_ENV = savedNodeEnv;
});

describe('cron-auth: CRON_SECRET unset in production fails closed', () => {
  it('denies the exact request shape Next.js delivers (localhost URL, no X-Forwarded-For)', () => {
    delete process.env.CRON_SECRET;
    env.NODE_ENV = 'production';

    const req = new Request('http://localhost:3000/api/pulse/cron/uptime', { method: 'POST' });
    expect(isCronAuthorized(req)).toBe(false);
  });

  it('denies a spoofed private X-Forwarded-For hop', () => {
    delete process.env.CRON_SECRET;
    env.NODE_ENV = 'production';

    const req = new Request('http://localhost:3000/api/pulse/cron/reports', {
      method: 'POST',
      headers: { 'x-forwarded-for': '10.1.2.3' },
    });
    expect(isCronAuthorized(req)).toBe(false);
  });

  it('denies a request carrying an x-cron-secret header when no secret is configured', () => {
    delete process.env.CRON_SECRET;
    env.NODE_ENV = 'production';

    const req = new Request('http://localhost:3000/api/pulse/cron/alerts', {
      method: 'POST',
      headers: { 'x-cron-secret': 'anything' },
    });
    expect(isCronAuthorized(req)).toBe(false);
  });
});

describe('cron-auth: CRON_SECRET set', () => {
  it('accepts the correct secret', () => {
    process.env.CRON_SECRET = 's3cr3t-value';

    const req = new Request('http://localhost:3000/api/pulse/cron/alerts', {
      method: 'POST',
      headers: { 'x-cron-secret': 's3cr3t-value' },
    });
    expect(isCronAuthorized(req)).toBe(true);
  });

  it('denies a wrong secret', () => {
    process.env.CRON_SECRET = 's3cr3t-value';

    const req = new Request('http://localhost:3000/api/pulse/cron/alerts', {
      method: 'POST',
      headers: { 'x-cron-secret': 'nope' },
    });
    expect(isCronAuthorized(req)).toBe(false);
  });

  it('denies a wrong secret of the same length', () => {
    process.env.CRON_SECRET = 's3cr3t-value';

    const req = new Request('http://localhost:3000/api/pulse/cron/alerts', {
      method: 'POST',
      headers: { 'x-cron-secret': 's3cr3t-valuf' },
    });
    expect(isCronAuthorized(req)).toBe(false);
  });

  it('denies a request with no x-cron-secret header', () => {
    process.env.CRON_SECRET = 's3cr3t-value';

    const req = new Request('http://localhost:3000/api/pulse/cron/alerts', { method: 'POST' });
    expect(isCronAuthorized(req)).toBe(false);
  });
});
