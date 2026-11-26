import { describe, expect, it } from 'vitest';
import { assertPublicUrl, checkPublicUrl, isPublicIp } from '@/lib/pulse/url-guard';

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
