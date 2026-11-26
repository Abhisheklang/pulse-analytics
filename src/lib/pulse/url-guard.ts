// Shared SSRF guard for server-side fetches of user-supplied URLs
// (uptime monitors, webhook delivery, event forwarding, warehouse export
// endpoints). Only http/https URLs whose host resolves exclusively to
// public addresses are allowed: loopback, private, link-local, metadata
// (169.254.169.254), multicast, reserved and otherwise non-unicast ranges
// are rejected, for literal IPs and for DNS names alike.

import { lookup } from 'node:dns/promises';
import ipaddr from 'ipaddr.js';

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsafeUrlError';
  }
}

export function isPublicIp(ip: string): boolean {
  if (!ipaddr.isValid(ip)) return false;
  const parsed = ipaddr.parse(ip);
  // An IPv4-mapped IPv6 address is judged by its embedded IPv4 address.
  if (parsed.kind() === 'ipv6') {
    const v6 = parsed as ipaddr.IPv6;
    if (v6.isIPv4MappedAddress()) {
      return isPublicIp(v6.toIPv4Address().toString());
    }
  }
  // ipaddr.js range() yields 'unicast' only for globally routable space;
  // loopback, private, linkLocal, multicast, reserved, carrierGradeNat,
  // uniqueLocal and unspecified are all non-public.
  return parsed.range() === 'unicast';
}

async function resolveHost(hostname: string): Promise<string[]> {
  const host = hostname.replace(/^\[|\]$/g, '');
  if (ipaddr.isValid(host)) return [host];
  const records = await lookup(host, { all: true, verbatim: true });
  return records.map(r => r.address);
}

// Throws UnsafeUrlError when the URL must not be fetched server-side.
// Returns the parsed URL when it is safe.
export async function assertPublicUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UnsafeUrlError(`Invalid URL: ${rawUrl}`);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new UnsafeUrlError(`Blocked URL scheme: ${url.protocol}`);
  }

  let addresses: string[];
  try {
    addresses = await resolveHost(url.hostname);
  } catch {
    throw new UnsafeUrlError(`Could not resolve host: ${url.hostname}`);
  }

  if (!addresses.length) {
    throw new UnsafeUrlError(`Could not resolve host: ${url.hostname}`);
  }

  for (const address of addresses) {
    if (!isPublicIp(address)) {
      throw new UnsafeUrlError(
        `Blocked URL: host ${url.hostname} resolves to a non-public address (${address})`,
      );
    }
  }

  return url;
}

// Non-throwing variant for call sites that record an error string instead
// of failing: returns the block reason, or null when the URL is safe.
export async function checkPublicUrl(rawUrl: string): Promise<string | null> {
  try {
    await assertPublicUrl(rawUrl);
    return null;
  } catch (e: any) {
    return e?.message || 'Blocked URL';
  }
}

// SEC-2: fetch that follows redirects manually and re-validates EVERY
// hop against the public-address guard. The platform default
// (redirect: 'follow') would follow a public URL's 302 to an internal
// address without any re-check. Mirrors the pattern uptime.ts already
// used for monitor checks. Throws UnsafeUrlError for a blocked hop or
// when the redirect budget is exhausted.
export async function guardedFetch(
  rawUrl: string,
  init: RequestInit = {},
  maxRedirects = 5,
): Promise<Response> {
  let url = (await assertPublicUrl(rawUrl)).toString();
  let method = (init.method || 'GET').toUpperCase();
  let body = init.body;

  for (let hop = 0; ; hop++) {
    const res = await fetch(url, { ...init, method, body, redirect: 'manual' });

    const location = res.headers.get('location');
    if (res.status < 300 || res.status >= 400 || !location) {
      return res;
    }

    // Drain the body so the socket can close cleanly.
    await res.text().catch(() => '');
    if (hop >= maxRedirects) {
      throw new UnsafeUrlError('Too many redirects');
    }

    url = (await assertPublicUrl(new URL(location, url).toString())).toString();

    // Per fetch semantics, 303 always converts to GET, and 301/302
    // convert a POST to GET; 307/308 preserve method and body.
    if (res.status === 303 || ((res.status === 301 || res.status === 302) && method === 'POST')) {
      method = 'GET';
      body = undefined;
    }
  }
}
