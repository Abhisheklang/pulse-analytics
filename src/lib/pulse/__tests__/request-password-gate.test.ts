import { beforeEach, describe, expect, it, vi } from 'vitest';

// Regression tests for SEC-5: the forced password change for accounts
// still using the seeded default password must be enforced by the API
// (parseRequest), not only by the web UI modal. The 2FA setup gate in
// parseRequest is the pattern this mirrors.

const mocks = vi.hoisted(() => ({ checkAuth: vi.fn() }));

vi.mock('@/lib/auth', () => ({ checkAuth: mocks.checkAuth }));

import { parseRequest } from '@/lib/request';

const req = () => new Request('http://localhost/api/websites', { method: 'GET' });

beforeEach(() => {
  mocks.checkAuth.mockReset();
});

describe('SEC-5: parseRequest password-change gate', () => {
  it('blocks a default-password session from ordinary routes', async () => {
    mocks.checkAuth.mockResolvedValue({
      user: { id: 'u1' },
      passwordChangeRequired: true,
      twoFactorSetupPending: false,
    });
    const { error } = await parseRequest(req());
    expect(error).toBeDefined();
    const res = error();
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('password-change-required');
  });

  it('allows the password-change route itself', async () => {
    mocks.checkAuth.mockResolvedValue({
      user: { id: 'u1' },
      passwordChangeRequired: true,
      twoFactorSetupPending: false,
    });
    const { error, auth } = await parseRequest(req(), undefined, { allowPasswordChange: true });
    expect(error).toBeUndefined();
    expect(auth.user.id).toBe('u1');
  });

  it('does not block sessions without the flag', async () => {
    mocks.checkAuth.mockResolvedValue({
      user: { id: 'u1' },
      passwordChangeRequired: false,
      twoFactorSetupPending: false,
    });
    const { error } = await parseRequest(req());
    expect(error).toBeUndefined();
  });

  it('does not block share-token auth (no user password)', async () => {
    mocks.checkAuth.mockResolvedValue({
      user: null,
      shareToken: 'share',
      passwordChangeRequired: false,
      twoFactorSetupPending: false,
    });
    const { error } = await parseRequest(req());
    expect(error).toBeUndefined();
  });
});
