import { beforeEach, describe, expect, it, vi } from 'vitest';

// Regression tests for SEC-1: Pulse write (create/update) responses must
// mask stored secrets exactly like the GET responses do. Before the fix,
// POST/PUT handlers returned the raw rows, leaking S3 secretAccessKey,
// BigQuery privateKey, Telegram bot tokens, the webhook signing secret and
// the credential-bearing uptime notify URL to any update-level caller.

const SECRET = 'super-secret-value';

const mocks = vi.hoisted(() => ({
  parseRequest: vi.fn(),
  canUpdateWebsite: vi.fn(),
  db: {
    pulseAlertRule: { create: vi.fn(), update: vi.fn(), findFirst: vi.fn() },
    pulseReportSchedule: { create: vi.fn() },
    pulseExportJob: { create: vi.fn(), update: vi.fn(), findFirst: vi.fn() },
    pulseWebhookConfig: { findUnique: vi.fn(), upsert: vi.fn() },
    pulseUptimeMonitor: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
  },
}));

vi.mock('@/lib/request', () => ({ parseRequest: mocks.parseRequest }));
vi.mock('@/permissions', () => ({
  canUpdateWebsite: mocks.canUpdateWebsite,
  canViewWebsite: vi.fn(async () => true),
}));
vi.mock('@/lib/prisma', () => ({ default: { client: mocks.db } }));

import { POST as alertsPOST, PUT as alertsPUT } from '@/app/api/pulse/websites/[websiteId]/alerts/route';
import { POST as exportsPOST } from '@/app/api/pulse/websites/[websiteId]/exports/route';
import { PUT as exportJobPUT } from '@/app/api/pulse/websites/[websiteId]/exports/[jobId]/route';
import { POST as reportsPOST } from '@/app/api/pulse/websites/[websiteId]/reports/route';
import { PUT as uptimePUT } from '@/app/api/pulse/websites/[websiteId]/uptime/route';
import { PUT as webhooksPUT } from '@/app/api/pulse/websites/[websiteId]/webhooks/route';
import { PULSE_SECRET_MASK } from '@/lib/pulse/secrets';

const params = Promise.resolve({ websiteId: 'site-1' });
const jobParams = Promise.resolve({ websiteId: 'site-1', jobId: 'job-1' });
const req = (path: string) => new Request(`http://localhost${path}`, { method: 'POST' });

function mockBody(body: any) {
  mocks.parseRequest.mockResolvedValue({
    auth: { user: { id: 'user-1', username: 'alice' } },
    body,
    error: undefined,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.canUpdateWebsite.mockResolvedValue(true);
});

describe('SEC-1: write responses mask stored secrets', () => {
  it('alerts POST masks the telegram bot token', async () => {
    mockBody({ channel: 'telegram', telegramBotToken: SECRET, telegramChatId: '42' });
    mocks.db.pulseAlertRule.create.mockImplementation(async ({ data }: any) => ({ id: 'r1', ...data }));
    const res = await alertsPOST(req('/alerts'), { params });
    const body = await res.json();
    expect(body.telegramBotToken).toBe(PULSE_SECRET_MASK);
    expect(JSON.stringify(body)).not.toContain(SECRET);
  });

  it('alerts PUT (enabled toggle) masks the stored telegram bot token', async () => {
    mockBody({ id: '11111111-1111-1111-1111-111111111111', enabled: false });
    mocks.db.pulseAlertRule.findFirst.mockResolvedValue({ id: 'r1', telegramBotToken: SECRET });
    mocks.db.pulseAlertRule.update.mockResolvedValue({ id: 'r1', enabled: false, telegramBotToken: SECRET });
    const res = await alertsPUT(req('/alerts'), { params });
    const body = await res.json();
    expect(body.telegramBotToken).toBe(PULSE_SECRET_MASK);
    expect(JSON.stringify(body)).not.toContain(SECRET);
  });

  it('reports POST masks the telegram bot token', async () => {
    mockBody({});
    mocks.db.pulseReportSchedule.create.mockResolvedValue({ id: 's1', telegramBotToken: SECRET });
    const res = await reportsPOST(req('/reports'), { params });
    const body = await res.json();
    expect(body.telegramBotToken).toBe(PULSE_SECRET_MASK);
    expect(JSON.stringify(body)).not.toContain(SECRET);
  });

  it('exports POST masks S3 and BigQuery secrets in the job config', async () => {
    mockBody({});
    mocks.db.pulseExportJob.create.mockResolvedValue({
      id: 'j1',
      config: { secretAccessKey: SECRET, privateKey: SECRET, bucket: 'b' },
    });
    const res = await exportsPOST(req('/exports'), { params });
    const body = await res.json();
    expect(body.job.config.secretAccessKey).toBe(PULSE_SECRET_MASK);
    expect(body.job.config.privateKey).toBe(PULSE_SECRET_MASK);
    expect(body.job.config.bucket).toBe('b');
    expect(JSON.stringify(body)).not.toContain(SECRET);
  });

  it('exports job PUT masks secrets in the updated job config', async () => {
    mockBody({});
    mocks.db.pulseExportJob.findFirst.mockResolvedValue({ id: 'job-1', websiteId: 'site-1' });
    mocks.db.pulseExportJob.update.mockResolvedValue({
      id: 'job-1',
      config: { secretAccessKey: SECRET },
    });
    const res = await exportJobPUT(req('/exports/job-1'), { params: jobParams });
    const body = await res.json();
    expect(body.job.config.secretAccessKey).toBe(PULSE_SECRET_MASK);
    expect(JSON.stringify(body)).not.toContain(SECRET);
  });

  it('webhooks PUT masks the forwarding secret', async () => {
    mockBody({ url: 'https://8.8.8.8/hook', events: 'all', secret: SECRET, enabled: true });
    mocks.db.pulseWebhookConfig.findUnique.mockResolvedValue(null);
    mocks.db.pulseWebhookConfig.upsert.mockImplementation(async ({ create }: any) => ({ id: 'w1', ...create }));
    const res = await webhooksPUT(req('/webhooks'), { params });
    const body = await res.json();
    expect(body.secret).toBe(PULSE_SECRET_MASK);
    expect(JSON.stringify(body)).not.toContain(SECRET);
  });

  it('uptime PUT masks the notify webhook URL', async () => {
    mockBody({ enabled: true, url: 'https://8.8.8.8/', intervalMinutes: 5, notifyWebhookUrl: `https://8.8.8.8/${SECRET}` });
    mocks.db.pulseUptimeMonitor.findUnique.mockResolvedValue(null);
    mocks.db.pulseUptimeMonitor.create.mockImplementation(async ({ data }: any) => ({ id: 'm1', ...data }));
    const res = await uptimePUT(req('/uptime'), { params });
    const body = await res.json();
    expect(body.notifyWebhookUrl).toBe(PULSE_SECRET_MASK);
    expect(JSON.stringify(body)).not.toContain(SECRET);
  });
});
