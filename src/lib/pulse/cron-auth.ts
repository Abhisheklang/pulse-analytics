function isPrivateOrLoopback(ip: string): boolean {
  const v = ip.trim().toLowerCase();
  return (
    v === '::1' ||
    v.startsWith('127.') ||
    v.startsWith('10.') ||
    v.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(v)
  );
}

export function isCronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;

  if (secret) {
    return request.headers.get('x-cron-secret') === secret;
  }

  // Without a configured secret, only allow local callers (this deployment
  // has no external scheduler; the trigger is meant for system cron on the host).
  // Requests may pass through a local sandbox/preview proxy that injects
  // X-Forwarded-For, so every hop must be loopback/private — a public first
  // hop is rejected.
  const url = new URL(request.url);
  const isLocalHost = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);

  if (!isLocalHost) return false;

  const forwardedFor = request.headers.get('x-forwarded-for');
  if (!forwardedFor) return true;

  const hops = forwardedFor
    .split(',')
    .map(h => h.trim())
    .filter(Boolean);
  return hops.every(isPrivateOrLoopback);
}
