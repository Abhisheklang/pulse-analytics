import { createServer, type Server } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  assertPublicUrl,
  checkPublicUrl,
  guardedFetch,
  isPublicIp,
  pinnedAgent,
  pinnedFetch,
} from '@/lib/pulse/url-guard';

// Regression tests for the SSRF guard (audit bug C3). Literal IPs and
// localhost only: no external DNS or network is needed.

describe('url-guard: isPublicIp', () => {
  it('accepts public addresses', () => {
    expect(isPublicIp('8.8.8.8')).toBe(true);
    expect(isPublicIp('1.1.1.1')).toBe(true);
    expect(isPublicIp('2606:4700:4700::1111')).toBe(true);
  });

  it('rejects loopback, private, link-local and metadata addresses', () => {
    expect(isPublicIp('127.0.0.1')).toBe(false);
    expect(isPublicIp('10.0.0.5')).toBe(false);
    expect(isPublicIp('172.16.0.1')).toBe(false);
    expect(isPublicIp('172.31.255.255')).toBe(false);
    expect(isPublicIp('192.168.1.1')).toBe(false);
    expect(isPublicIp('169.254.169.254')).toBe(false);
    expect(isPublicIp('::1')).toBe(false);
    expect(isPublicIp('fe80::1')).toBe(false);
    expect(isPublicIp('fd00::1')).toBe(false);
    expect(isPublicIp('0.0.0.0')).toBe(false);
  });

  it('judges IPv4-mapped IPv6 addresses by the embedded IPv4 address', () => {
    expect(isPublicIp('::ffff:127.0.0.1')).toBe(false);
    expect(isPublicIp('::ffff:8.8.8.8')).toBe(true);
  });

  it('rejects non-IP input', () => {
    expect(isPublicIp('not-an-ip')).toBe(false);
    expect(isPublicIp('')).toBe(false);
  });
});

describe('url-guard: assertPublicUrl / checkPublicUrl', () => {
  it('allows a public literal-IP URL', async () => {
    const url = await assertPublicUrl('http://8.8.8.8/hook');
    expect(url.hostname).toBe('8.8.8.8');
    expect(await checkPublicUrl('https://1.1.1.1/hook')).toBeNull();
  });

  it('blocks the cloud metadata address', async () => {
    await expect(assertPublicUrl('http://169.254.169.254/latest/meta-data/')).rejects.toThrow(
      /non-public/,
    );
    expect(await checkPublicUrl('http://169.254.169.254/')).toMatch(/Blocked URL/);
  });

  it('blocks loopback and private literal IPs', async () => {
    expect(await checkPublicUrl('http://127.0.0.1:3000/admin')).toMatch(/Blocked URL/);
    expect(await checkPublicUrl('http://192.168.0.10/hook')).toMatch(/Blocked URL/);
    expect(await checkPublicUrl('http://[::1]/hook')).toMatch(/Blocked URL/);
  });

  it('blocks localhost by name', async () => {
    expect(await checkPublicUrl('http://localhost:8080/hook')).toMatch(/Blocked URL/);
  });

  it('blocks non-http schemes and invalid URLs', async () => {
    expect(await checkPublicUrl('file:///etc/passwd')).toMatch(/scheme/);
    expect(await checkPublicUrl('gopher://8.8.8.8/')).toMatch(/scheme/);
    expect(await checkPublicUrl('not a url')).toMatch(/Invalid URL/);
  });
});

describe('url-guard: guardedFetch redirect revalidation (SEC-2)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function fakeResponse(status: number, location?: string) {
    return {
      status,
      ok: status >= 200 && status < 300,
      headers: { get: (name: string) => (name === 'location' ? location || null : null) },
      text: async () => '',
    } as any;
  }

  it('returns a direct response without following anything', async () => {
    const fetchMock = vi.fn(async (_url: any, _init?: any) => fakeResponse(200));
    vi.stubGlobal('fetch', fetchMock);
    const res = await guardedFetch('http://8.8.8.8/hook', { method: 'POST', body: '{}' });
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1].redirect).toBe('manual');
  });

  it('blocks a redirect from a public URL to the metadata address', async () => {
    const fetchMock = vi.fn(async () =>
      fakeResponse(302, 'http://169.254.169.254/latest/meta-data/'),
    );
    vi.stubGlobal('fetch', fetchMock);
    await expect(guardedFetch('http://8.8.8.8/hook', { method: 'POST' })).rejects.toThrow(
      /non-public/,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('blocks a redirect to loopback', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => fakeResponse(301, 'http://127.0.0.1:3000/admin')),
    );
    await expect(guardedFetch('http://8.8.8.8/hook')).rejects.toThrow(/non-public/);
  });

  it('follows a redirect to another public URL', async () => {
    const fetchMock = vi
      .fn(async (_url: any, _init?: any) => fakeResponse(200))
      .mockResolvedValueOnce(fakeResponse(307, 'http://1.1.1.1/final'))
      .mockResolvedValueOnce(fakeResponse(200));
    vi.stubGlobal('fetch', fetchMock);
    const res = await guardedFetch('http://8.8.8.8/hook', { method: 'PUT', body: 'x' });
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe('http://1.1.1.1/final');
    // 307 preserves method and body.
    expect(fetchMock.mock.calls[1][1].method).toBe('PUT');
    expect(fetchMock.mock.calls[1][1].body).toBe('x');
  });

  it('gives up after the redirect budget', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => fakeResponse(302, 'http://8.8.8.8/again')),
    );
    await expect(guardedFetch('http://8.8.8.8/hook', {}, 3)).rejects.toThrow(/Too many redirects/);
  });

  it('blocks the initial URL before any fetch happens', async () => {
    const fetchMock = vi.fn(async () => fakeResponse(200));
    vi.stubGlobal('fetch', fetchMock);
    await expect(guardedFetch('http://192.168.1.1/hook')).rejects.toThrow(/non-public/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('url-guard: IP pinning (P-ADV-5)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('pinnedFetch fetches through a dispatcher so the connection is pinned', async () => {
    const fetchMock = vi.fn(async (_url: any, _init?: any) => ({
      status: 200,
      ok: true,
      headers: { get: () => null },
      text: async () => '',
    }) as any);
    vi.stubGlobal('fetch', fetchMock);
    const res = await pinnedFetch('http://8.8.8.8/hook', { method: 'POST', body: '{}' });
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // The dispatcher is the pinning Agent: without it fetch would
    // re-resolve the hostname independently of the guard's check.
    expect(fetchMock.mock.calls[0][1].dispatcher).toBeDefined();
    expect(fetchMock.mock.calls[0][1].redirect).toBe('manual');
  });

  it('pinnedFetch still blocks non-public addresses before any fetch', async () => {
    const fetchMock = vi.fn(async () => ({}) as any);
    vi.stubGlobal('fetch', fetchMock);
    await expect(pinnedFetch('http://169.254.169.254/')).rejects.toThrow(/non-public/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('pinnedAgent connects to the validated address, not a fresh DNS answer', async () => {
    // The hostname used here does not resolve anywhere; the only way
    // the request can land on the loopback server is if the agent's
    // lookup returns exactly the pinned (validated) addresses. This
    // is the DNS-rebinding closure: the checked address is the
    // connected address.
    let seenHost: string | undefined;
    const server: Server = createServer((req, res) => {
      seenHost = req.headers.host;
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('pinned-ok');
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as any).port;
    const agent = pinnedAgent(['127.0.0.1']);
    try {
      const res = await fetch(`http://rebind.invalid:${port}/probe`, {
        dispatcher: agent,
      } as any);
      expect(res.status).toBe(200);
      expect(await res.text()).toBe('pinned-ok');
      // Host header keeps the original hostname (virtual hosting and
      // TLS SNI are unaffected by pinning).
      expect(seenHost).toBe(`rebind.invalid:${port}`);
    } finally {
      await agent.close();
      await new Promise(resolve => server.close(resolve));
    }
  });
});
