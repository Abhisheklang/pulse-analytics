// Small in-memory fixed-window rate limiter for credential and
// cost-bearing endpoints (SEC-3). The 2FA limiter in
// src/lib/two-factor/rate-limit.ts is database-backed and scoped to a
// user id; login attempts happen before a user is authenticated and
// Ask Pulse can be reached with a share token, so these endpoints key
// on client IP (plus a caller-supplied subject) in process memory.
// This is a per-instance control: it stops online guessing and quota
// burn against a single deployment process, which is the threat these
// two endpoints face.

import { getIpAddress } from '@/lib/ip';

interface WindowEntry {
  count: number;
  resetAt: number;
}

const windows = new Map<string, WindowEntry>();

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

/** Count one hit for `key`; allowed until `limit` hits per `windowMs`. */
export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const entry = windows.get(key);

  if (!entry || entry.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  entry.count += 1;
  if (entry.count > limit) {
    return { allowed: false, retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000) };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

/** Forget a key (for example after a successful login). */
export function resetRateLimitKey(key: string): void {
  windows.delete(key);
}

export function rateLimitKey(request: Request, scope: string, subject?: string | null): string {
  const ip = getIpAddress(request.headers) || 'unknown';
  return `${scope}:${ip}:${subject || ''}`;
}

export function tooManyRequests(retryAfterSeconds: number): Response {
  return Response.json(
    {
      error: {
        message: 'Too many requests. Please try again later.',
        code: 'rate-limit-exceeded',
        status: 429,
      },
    },
    { status: 429, headers: { 'retry-after': String(Math.max(1, retryAfterSeconds)) } },
  );
}
