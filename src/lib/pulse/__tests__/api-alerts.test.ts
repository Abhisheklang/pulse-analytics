import { beforeEach, describe, expect, it, vi } from 'vitest';

// API-level tests for the Pulse alerts route
// (src/app/api/pulse/websites/[websiteId]/alerts). The route handler runs for
// real; the request/auth layer, the permission checks and the Prisma client
// behind pulseDb() are mocked, following the repo's existing route tests.
// No database and no network: delivery itself is not exercised here, only
// rule listing, creation validation and toggling.

const mocks = vi.hoisted(() => ({
  parseRequest: vi.fn(),
  canViewWebsite: vi.fn(),
  canUpdateWebsite: vi.fn(),
  db: {
    pulseAlertRule: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    pulseAlertLog: { findMany: vi.fn() },
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

import { GET, POST, PUT } from '@/app/api/pulse/websites/[websiteId]/alerts/route';

const params = Promise.resolve({ websiteId: 'site-1' });
const url = 'http://localhost/api/pulse/websites/site-1/alerts';

const existingRule = {
  id: 'rule-1',
  websiteId: 'site-1',
  name: 'Traffic spike',
  metric: 'pageviews',
  condition: 'spike',
  threshold: 100,
  windowHours: 24,
  webhookUrl: 'https://example.com/hook',
  channel: 'webhook',
  enabled: true,
};

beforeEach(() => {
  mocks.parseRequest.mockReset();
  mocks.canViewWebsite.mockReset();
  mocks.canUpdateWebsite.mockReset();
  mocks.db.pulseAlertRule.findMany.mockReset();
  mocks.db.pulseAlertRule.findFirst.mockReset();
  mocks.db.pulseAlertRule.create.mockReset();
  mocks.db.pulseAlertRule.update.mockReset();
  mocks.db.pulseAlertLog.findMany.mockReset();

  mocks.canViewWebsite.mockResolvedValue(true);
  mocks.canUpdateWebsite.mockResolvedValue(true);
  mocks.db.pulseAlertRule.findMany.mockResolvedValue([existingRule]);
  mocks.db.pulseAlertLog.findMany.mockResolvedValue([]);
  mocks.db.pulseAlertRule.create.mockImplementation(async ({ data }: any) => ({
    id: 'rule-new',
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

describe('Alerts API: GET', () => {
  it('lists the rules and recent logs for the website', async () => {
    mockBody(undefined);

    const response = await GET(new Request(url), { params });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.rules).toEqual([existingRule]);
    expect(body.logs).toEqual([]);
    expect(mocks.db.pulseAlertRule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { websiteId: 'site-1' } }),
    );
  });

  it('rejects a user who cannot view the website', async () => {
    mockBody(undefined);
    mocks.canViewWebsite.mockResolvedValue(false);

    const response = await GET(new Request(url), { params });

    expect(response.status).toBe(401);
    expect(mocks.db.pulseAlertRule.findMany).not.toHaveBeenCalled();
  });
});

describe('Alerts API: POST create', () => {
  it('creates a webhook rule with the posted fields', async () => {
    mockBody({
      name: 'Weekend drop',
      metric: 'visitors',
      condition: 'drop',
      threshold: 40,
      windowHours: 48,
      webhookUrl: 'https://example.com/hook',
      channel: 'webhook',
      enabled: true,
    });

    const response = await POST(new Request(url, { method: 'POST' }), { params });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ name: 'Weekend drop', channel: 'webhook', websiteId: 'site-1' });
    expect(mocks.db.pulseAlertRule.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        websiteId: 'site-1',
        name: 'Weekend drop',
        metric: 'visitors',
        condition: 'drop',
        webhookUrl: 'https://example.com/hook',
      }),
    });
  });

  it('rejects a Telegram rule without a chat ID', async () => {
    mockBody({
      name: 'Telegram rule',
      metric: 'pageviews',
      condition: 'spike',
      threshold: 10,
      windowHours: 24,
      channel: 'telegram',
      telegramBotToken: 'bot-token',
      enabled: true,
    });

    const response = await POST(new Request(url, { method: 'POST' }), { params });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.message).toMatch(/Telegram rules need a bot token and a chat ID/);
    expect(mocks.db.pulseAlertRule.create).not.toHaveBeenCalled();
  });

  it('rejects a webhook-channel rule without a webhook URL', async () => {
    mockBody({
      name: 'Slack rule',
      metric: 'pageviews',
      condition: 'above',
      threshold: 10,
      windowHours: 24,
      channel: 'slack',
      enabled: true,
    });

    const response = await POST(new Request(url, { method: 'POST' }), { params });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.message).toMatch(/webhook URL is required/);
    expect(mocks.db.pulseAlertRule.create).not.toHaveBeenCalled();
  });

  it('rejects a user who cannot update the website', async () => {
    mockBody({
      name: 'Nope',
      metric: 'pageviews',
      condition: 'spike',
      threshold: 1,
      windowHours: 24,
      webhookUrl: 'https://example.com/hook',
      channel: 'webhook',
      enabled: true,
    });
    mocks.canUpdateWebsite.mockResolvedValue(false);

    const response = await POST(new Request(url, { method: 'POST' }), { params });

    expect(response.status).toBe(401);
    expect(mocks.db.pulseAlertRule.create).not.toHaveBeenCalled();
  });
});

describe('Alerts API: PUT toggle', () => {
  it('flips the enabled flag on an existing rule', async () => {
    mockBody({ id: 'rule-1', enabled: false });
    mocks.db.pulseAlertRule.findFirst.mockResolvedValue(existingRule);
    mocks.db.pulseAlertRule.update.mockResolvedValue({ ...existingRule, enabled: false });

    const response = await PUT(new Request(url, { method: 'PUT' }), { params });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.enabled).toBe(false);
    expect(mocks.db.pulseAlertRule.update).toHaveBeenCalledWith({
      where: { id: 'rule-1' },
      data: { enabled: false },
    });
  });

  it('returns a bad request when the rule does not exist', async () => {
    mockBody({ id: 'rule-missing', enabled: false });
    mocks.db.pulseAlertRule.findFirst.mockResolvedValue(null);

    const response = await PUT(new Request(url, { method: 'PUT' }), { params });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.message).toMatch(/Rule not found/);
    expect(mocks.db.pulseAlertRule.update).not.toHaveBeenCalled();
  });
});
