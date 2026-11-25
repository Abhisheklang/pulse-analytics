import { beforeEach, describe, expect, it, vi } from 'vitest';

// API-level tests for the Pulse GDPR toolkit routes:
//   src/app/api/pulse/websites/[websiteId]/privacy          (settings, data range)
//   src/app/api/pulse/websites/[websiteId]/privacy/visitor  (lookup, export, erasure)
// The route handlers run for real; the request/auth layer, the permission
// checks and the Prisma client behind pulseDb() are mocked, following the
// repo's existing route-test pattern. No database, no network.

const mocks = vi.hoisted(() => ({
  parseRequest: vi.fn(),
  canViewWebsite: vi.fn(),
  canUpdateWebsite: vi.fn(),
  db: {
    pulseSiteSetting: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    pulseAuditLog: { create: vi.fn() },
    websiteEvent: {
      aggregate: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    session: { count: vi.fn(), findFirst: vi.fn(), deleteMany: vi.fn() },
    sessionData: { findMany: vi.fn(), deleteMany: vi.fn() },
    sessionLink: { deleteMany: vi.fn() },
    eventData: { deleteMany: vi.fn() },
    revenue: { deleteMany: vi.fn() },
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

import { GET as privacyGET, PUT as privacyPUT } from '@/app/api/pulse/websites/[websiteId]/privacy/route';
import {
  DELETE as visitorDELETE,
  GET as visitorGET,
} from '@/app/api/pulse/websites/[websiteId]/privacy/visitor/route';

const params = Promise.resolve({ websiteId: 'site-1' });
const privacyUrl = 'http://localhost/api/pulse/websites/site-1/privacy';
const visitorUrl = 'http://localhost/api/pulse/websites/site-1/privacy/visitor';

const existingSetting = {
  websiteId: 'site-1',
  retentionDays: 30,
  badgeEnabled: false,
  badgeToken: 'tok123',
};

const session = { id: 'sess-1', websiteId: 'site-1', browser: 'Firefox' };

beforeEach(() => {
  mocks.parseRequest.mockReset();
  mocks.canViewWebsite.mockReset();
  mocks.canUpdateWebsite.mockReset();
  for (const model of Object.values(mocks.db)) {
    for (const fn of Object.values(model)) fn.mockReset();
  }

  mocks.parseRequest.mockResolvedValue({
    auth: { user: { id: 'user-1', username: 'alice' } },
    body: undefined,
    error: undefined,
  });
  mocks.canViewWebsite.mockResolvedValue(true);
  mocks.canUpdateWebsite.mockResolvedValue(true);

  mocks.db.pulseSiteSetting.findUnique.mockResolvedValue(existingSetting);
  mocks.db.websiteEvent.aggregate.mockResolvedValue({
    _min: { createdAt: new Date('2026-01-01T00:00:00.000Z') },
    _max: { createdAt: new Date('2026-11-20T00:00:00.000Z') },
  });
  mocks.db.websiteEvent.count.mockResolvedValue(120);
  mocks.db.session.count.mockResolvedValue(45);
});

function mockBody(body: any) {
  mocks.parseRequest.mockResolvedValue({
    auth: { user: { id: 'user-1', username: 'alice' } },
    body,
    error: undefined,
  });
}

describe('GDPR toolkit API: privacy overview', () => {
  it('returns the site setting, the stored data range and the counts', async () => {
    const response = await privacyGET(new Request(privacyUrl), { params });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.setting).toEqual(existingSetting);
    expect(body.eventCount).toBe(120);
    expect(body.sessionCount).toBe(45);
    expect(body.dataRange.from).toBe('2026-01-01T00:00:00.000Z');
    expect(body.dataRange.to).toBe('2026-11-20T00:00:00.000Z');
  });

  it('creates a default setting on first access', async () => {
    mocks.db.pulseSiteSetting.findUnique.mockResolvedValue(null);
    const created = { websiteId: 'site-1', retentionDays: 0, badgeEnabled: false, badgeToken: 'newtok' };
    mocks.db.pulseSiteSetting.create.mockResolvedValue(created);

    const response = await privacyGET(new Request(privacyUrl), { params });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.setting).toEqual(created);
    expect(mocks.db.pulseSiteSetting.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ websiteId: 'site-1', retentionDays: 0, badgeEnabled: false }),
    });
  });

  it('rejects a user who cannot view the website', async () => {
    mocks.canViewWebsite.mockResolvedValue(false);

    const response = await privacyGET(new Request(privacyUrl), { params });

    expect(response.status).toBe(401);
    expect(mocks.db.pulseSiteSetting.findUnique).not.toHaveBeenCalled();
  });

  it('updates the retention period for a user who can update the website', async () => {
    mockBody({ retentionDays: 90 });
    mocks.db.pulseSiteSetting.update.mockResolvedValue({ ...existingSetting, retentionDays: 90 });

    const response = await privacyPUT(new Request(privacyUrl, { method: 'PUT' }), { params });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.retentionDays).toBe(90);
    expect(mocks.db.pulseSiteSetting.update).toHaveBeenCalledWith({
      where: { websiteId: 'site-1' },
      data: { retentionDays: 90 },
    });
  });

  it('rejects a retention update from a user who cannot update the website', async () => {
    mockBody({ retentionDays: 90 });
    mocks.canUpdateWebsite.mockResolvedValue(false);

    const response = await privacyPUT(new Request(privacyUrl, { method: 'PUT' }), { params });

    expect(response.status).toBe(401);
    expect(mocks.db.pulseSiteSetting.update).not.toHaveBeenCalled();
  });
});

describe('GDPR toolkit API: visitor lookup and erasure', () => {
  it('requires a sessionId for a visitor lookup', async () => {
    const response = await visitorGET(new Request(visitorUrl), { params });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.message).toMatch(/sessionId is required/);
  });

  it('returns the visitor record with event data flattened for export', async () => {
    mocks.db.session.findFirst.mockResolvedValue(session);
    mocks.db.websiteEvent.findMany.mockResolvedValue([
      {
        id: 'e1',
        websiteId: 'site-1',
        sessionId: 'sess-1',
        eventData: [
          { dataKey: 'plan', stringValue: 'pro', numberValue: null, dateValue: null },
          { dataKey: 'seats', stringValue: null, numberValue: 3, dateValue: null },
        ],
      },
    ]);
    mocks.db.sessionData.findMany.mockResolvedValue([]);

    const response = await visitorGET(new Request(`${visitorUrl}?sessionId=sess-1`), { params });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.found).toBe(true);
    expect(body.session).toEqual(session);
    expect(body.events).toHaveLength(1);
    expect(body.events[0].data).toEqual({ plan: 'pro', seats: 3 });
    expect(body.events[0].eventData).toBeUndefined();
  });

  it('reports a visitor who is not stored', async () => {
    mocks.db.session.findFirst.mockResolvedValue(null);

    const response = await visitorGET(new Request(`${visitorUrl}?sessionId=ghost`), { params });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ found: false, sessionId: 'ghost' });
  });

  it('erases a visitor across every table and writes an audit entry', async () => {
    mocks.db.session.findFirst.mockResolvedValue(session);
    mocks.db.websiteEvent.findMany.mockResolvedValue([{ id: 'e1' }, { id: 'e2' }]);
    mocks.db.eventData.deleteMany.mockResolvedValue({ count: 5 });
    mocks.db.revenue.deleteMany.mockResolvedValue({ count: 0 });
    mocks.db.websiteEvent.deleteMany.mockResolvedValue({ count: 2 });
    mocks.db.sessionData.deleteMany.mockResolvedValue({ count: 1 });
    mocks.db.sessionLink.deleteMany.mockResolvedValue({ count: 0 });
    mocks.db.session.deleteMany.mockResolvedValue({ count: 1 });
    mocks.db.pulseAuditLog.create.mockResolvedValue({});

    const response = await visitorDELETE(
      new Request(`${visitorUrl}?sessionId=sess-1`, { method: 'DELETE' }),
      { params },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      deleted: true,
      sessionId: 'sess-1',
      eventsDeleted: 2,
      eventDataDeleted: 5,
      sessionDataDeleted: 1,
      sessionsDeleted: 1,
    });
    expect(mocks.db.session.deleteMany).toHaveBeenCalledWith({
      where: { id: 'sess-1', websiteId: 'site-1' },
    });
    expect(mocks.db.pulseAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'visitor_delete', websiteId: 'site-1' }),
    });
  });

  it('refuses to erase a visitor who is not stored', async () => {
    mocks.db.session.findFirst.mockResolvedValue(null);

    const response = await visitorDELETE(
      new Request(`${visitorUrl}?sessionId=ghost`, { method: 'DELETE' }),
      { params },
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.message).toMatch(/Visitor session not found/);
    expect(mocks.db.websiteEvent.deleteMany).not.toHaveBeenCalled();
  });

  it('rejects erasure from a user who cannot update the website', async () => {
    mocks.canUpdateWebsite.mockResolvedValue(false);

    const response = await visitorDELETE(
      new Request(`${visitorUrl}?sessionId=sess-1`, { method: 'DELETE' }),
      { params },
    );

    expect(response.status).toBe(401);
    expect(mocks.db.session.findFirst).not.toHaveBeenCalled();
  });
});
