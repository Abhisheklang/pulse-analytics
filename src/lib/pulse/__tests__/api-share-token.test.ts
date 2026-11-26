import { beforeEach, describe, expect, it, vi } from 'vitest';

// Regression tests for P-ADV-3: a valid share token authenticates with
// auth.user = null. GET /api/pulse/dashboards and GET /api/pulse/rollup
// dereferenced auth.user and returned an unhandled 500. They must return
// 401 for share callers and keep working for signed-in users.

const mocks = vi.hoisted(() => ({
  parseRequest: vi.fn(),
  findManyDashboards: vi.fn(),
  getAccessibleWebsites: vi.fn(),
  getPeriodStats: vi.fn(),
}));

vi.mock('@/lib/request', () => ({
  parseRequest: mocks.parseRequest,
}));

vi.mock('@/lib/pulse/stats', () => ({
  pulseDb: () => ({
    pulseDashboard: { findMany: mocks.findManyDashboards },
    websiteEvent: { findMany: vi.fn(async () => []) },
  }),
  getPeriodStats: mocks.getPeriodStats,
}));

vi.mock('@/lib/pulse/accessible-websites', () => ({
  getAccessibleWebsites: mocks.getAccessibleWebsites,
}));

vi.mock('@/lib/pulse/revenue', () => ({
  getRevenueReport: vi.fn(async () => ({})),
}));

import { GET as dashboardsGET } from '@/app/api/pulse/dashboards/route';
import { GET as rollupGET } from '@/app/api/pulse/rollup/route';

const shareAuth = { auth: { user: null, shareToken: { websiteId: 'site-1' } }, error: undefined };
const userAuth = { auth: { user: { id: 'user-1' } }, error: undefined };

describe('P-ADV-3 share-token handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('dashboards returns 401, not 500, for a share token', async () => {
    mocks.parseRequest.mockResolvedValue(shareAuth);

    const res = await dashboardsGET(new Request('http://localhost/api/pulse/dashboards'));

    expect(res.status).toBe(401);
    expect(mocks.findManyDashboards).not.toHaveBeenCalled();
  });

  it('rollup returns 401, not 500, for a share token', async () => {
    mocks.parseRequest.mockResolvedValue(shareAuth);

    const res = await rollupGET(new Request('http://localhost/api/pulse/rollup'));

    expect(res.status).toBe(401);
    expect(mocks.getAccessibleWebsites).not.toHaveBeenCalled();
  });

  it('dashboards still returns data for a signed-in user', async () => {
    mocks.parseRequest.mockResolvedValue(userAuth);
    mocks.findManyDashboards.mockResolvedValue([{ id: 'dash-1' }]);

    const res = await dashboardsGET(new Request('http://localhost/api/pulse/dashboards'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.dashboards).toEqual([{ id: 'dash-1' }]);
  });

  it('rollup still returns data for a signed-in user', async () => {
    mocks.parseRequest.mockResolvedValue(userAuth);
    mocks.getAccessibleWebsites.mockResolvedValue([]);
    mocks.getPeriodStats.mockResolvedValue({
      pageviews: 0,
      visitors: 0,
      visits: 0,
      bounces: 0,
    });

    const res = await rollupGET(new Request('http://localhost/api/pulse/rollup'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.perSite).toEqual([]);
  });
});
