import { timingSafeEqual } from 'node:crypto';

export function isCronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;

  // Fail closed: without a configured secret there is no fallback. The
  // previous host-header and X-Forwarded-For based fallback authorized
  // remote callers in production, because Next.js builds the route-handler
  // request URL from the server listen hostname (localhost by default) and
  // a remote caller can simply omit or spoof the forwarding header.
  if (!secret) {
    return false;
  }

  const provided = request.headers.get('x-cron-secret');
  if (!provided) {
    return false;
  }

  const providedBuffer = Buffer.from(provided);
  const secretBuffer = Buffer.from(secret);
  if (providedBuffer.length !== secretBuffer.length) {
    return false;
  }

  return timingSafeEqual(providedBuffer, secretBuffer);
}
