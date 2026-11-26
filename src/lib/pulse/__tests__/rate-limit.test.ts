import { describe, expect, it } from 'vitest';
import { checkRateLimit, rateLimitKey, resetRateLimitKey } from '@/lib/rate-limit';

// Unit tests for the shared limiter wired to /api/auth/login and the
// Ask Pulse endpoint under SEC-3.

describe('rate-limit: checkRateLimit', () => {
  it('allows up to the limit, then blocks until the window passes', () => {
    const key = `test:${Math.random()}`;
    for (let i = 0; i < 3; i++) {
      expect(checkRateLimit(key, 3, 60_000).allowed).toBe(true);
    }
    const blocked = checkRateLimit(key, 3, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it('resetRateLimitKey clears the counter', () => {
    const key = `test-reset:${Math.random()}`;
    checkRateLimit(key, 1, 60_000);
    expect(checkRateLimit(key, 1, 60_000).allowed).toBe(false);
    resetRateLimitKey(key);
    expect(checkRateLimit(key, 1, 60_000).allowed).toBe(true);
  });

  it('keys are independent', () => {
    const a = `test-a:${Math.random()}`;
    const b = `test-b:${Math.random()}`;
    checkRateLimit(a, 1, 60_000);
    expect(checkRateLimit(a, 1, 60_000).allowed).toBe(false);
    expect(checkRateLimit(b, 1, 60_000).allowed).toBe(true);
  });

  it('rateLimitKey scopes by subject', () => {
    const req = new Request('http://localhost/api/auth/login', { method: 'POST' });
    expect(rateLimitKey(req, 'login', 'alice')).not.toBe(rateLimitKey(req, 'login', 'bob'));
    expect(rateLimitKey(req, 'login', 'alice')).toContain('login');
  });
});
