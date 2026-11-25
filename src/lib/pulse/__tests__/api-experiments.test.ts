import { beforeEach, describe, expect, it, vi } from 'vitest';

// API-level tests for the Pulse experiments route
// (src/app/api/pulse/websites/[websiteId]/experiments). The route handler and
// the real results computation in src/lib/pulse/experiments.ts run against a
// mocked Prisma client (empty event tables, so exposures are zero), following
// the repo's existing route-test mocking pattern. No database, no network.

const mocks = vi.hoisted(() => ({
  parseRequest: vi.fn(),
  canViewWebsite: vi.fn(),
  canUpdateWebsite: vi.fn(),
  db: {
    pulseExperiment: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    websiteEvent: { findMany: vi.fn() },
  },
}));

vi.mock('@/lib/request', () => ({
  parseRequest: mocks.parseRequest,
}));

vi.mock('@/permissions', () => ({
  canViewWebsite: mocks.canViewWebsite,
  canUpdateWebsite: mocks.canUpdateWebsite,
}));

vi.mock('@/lib/prisma', () => ({
  default: { client: mocks.db },
}));

import { GET, POST } from '@/app/api/pulse/websites/[websiteId]/experiments/route';

const params = Promise.resolve({ websiteId: 'site-1' });
const url = 'http://localhost/api/pulse/websites/site-1/experiments';

const validBody = {
  name: 'Hero headline test',
  key: 'hero-test',
  conversionEvent: 'signup',
  status: 'draft',
  variants: [
    { key: 'a', weight: 50 },
    { key: 'b', weight: 50 },
  ],
};

beforeEach(() => {
  mocks.parseRequest.mockReset();
  mocks.canViewWebsite.mockReset();
  mocks.canUpdateWebsite.mockReset();
  mocks.db.pulseExperiment.findMany.mockReset();
  mocks.db.pulseExperiment.findFirst.mockReset();
  mocks.db.pulseExperiment.create.mockReset();
  mocks.db.websiteEvent.findMany.mockReset();

  mocks.canViewWebsite.mockResolvedValue(true);
  mocks.canUpdateWebsite.mockResolvedValue(true);
  mocks.db.pulseExperiment.findMany.mockResolvedValue([]);
  mocks.db.pulseExperiment.findFirst.mockResolvedValue(null);
  mocks.db.websiteEvent.findMany.mockResolvedValue([]);
  mocks.db.pulseExperiment.create.mockImplementation(async ({ data }: any) => ({
    id: 'exp-1',
    createdAt: new Date('2026-11-20T00:00:00.000Z'),
    ...data,
  }));
});

function mockBody(body: any) {
  mocks.parseRequest.mockResolvedValue({
    auth: { user: { id: 'user-1', username: 'alice' } },
    body,
    error: undefined,
  });
}

describe('Experiments API: GET', () => {
  it('lists the experiments for the website', async () => {
    mockBody(undefined);
    const experiment = { id: 'exp-0', websiteId: 'site-1', key: 'old-test', variants: [] };
    mocks.db.pulseExperiment.findMany.mockResolvedValue([experiment]);

    const response = await GET(new Request(url), { params });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.experiments).toEqual([experiment]);
    expect(mocks.db.pulseExperiment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { websiteId: 'site-1' } }),
    );
  });

  it('rejects a user who cannot view the website', async () => {
    mockBody(undefined);
    mocks.canViewWebsite.mockResolvedValue(false);

    const response = await GET(new Request(url), { params });

    expect(response.status).toBe(401);
    expect(mocks.db.pulseExperiment.findMany).not.toHaveBeenCalled();
  });
});

describe('Experiments API: POST create', () => {
  it('creates an experiment, normalises variants and returns empty results', async () => {
    mockBody(validBody);

    const response = await POST(new Request(url, { method: 'POST' }), { params });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.experiment).toMatchObject({ key: 'hero-test', websiteId: 'site-1' });
    // First variant is forced to control, names default to keys.
    expect(body.experiment.variants).toEqual([
      { key: 'a', name: 'a', weight: 50, control: true },
      { key: 'b', name: 'b', weight: 50, control: false },
    ]);
    // Results are computed by the real getExperimentResults over the mocked
    // (empty) event tables: both variants report zero exposures.
    expect(body.results.controlKey).toBe('a');
    expect(body.results.results).toHaveLength(2);
    for (const variant of body.results.results) {
      expect(variant.exposures).toBe(0);
      expect(variant.conversions).toBe(0);
    }
  });

  it('rejects a duplicate experiment key for the website', async () => {
    mockBody(validBody);
    mocks.db.pulseExperiment.findFirst.mockResolvedValue({ id: 'exp-0', key: 'hero-test' });

    const response = await POST(new Request(url, { method: 'POST' }), { params });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.message).toMatch(/already exists/);
    expect(mocks.db.pulseExperiment.create).not.toHaveBeenCalled();
  });

  it('rejects duplicate variant keys inside one experiment', async () => {
    mockBody({
      ...validBody,
      variants: [
        { key: 'a', weight: 50 },
        { key: 'a', weight: 50 },
      ],
    });

    const response = await POST(new Request(url, { method: 'POST' }), { params });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.message).toMatch(/Duplicate variant key/);
    expect(mocks.db.pulseExperiment.create).not.toHaveBeenCalled();
  });

  it('rejects a user who cannot update the website', async () => {
    mockBody(validBody);
    mocks.canUpdateWebsite.mockResolvedValue(false);

    const response = await POST(new Request(url, { method: 'POST' }), { params });

    expect(response.status).toBe(401);
    expect(mocks.db.pulseExperiment.create).not.toHaveBeenCalled();
  });
});
