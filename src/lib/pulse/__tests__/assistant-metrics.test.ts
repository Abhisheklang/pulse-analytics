import { describe, expect, it, vi } from 'vitest';

// Regression tests for COR-1 (Ask Pulse day bucketing must be UTC
// throughout) and COR-2 (trend and top answers must use the requested
// metric, and top shares must be of the period total, not of the
// top-N rows). Prisma is mocked; no database is used.

const mocks = vi.hoisted(() => ({
  events: [] as any[],
  sessions: [] as any[],
  db: {
    websiteEvent: { findMany: vi.fn(), groupBy: vi.fn() },
    session: { findMany: vi.fn(), groupBy: vi.fn() },
  },
}));

vi.mock('@/lib/prisma', () => ({ default: { client: mocks.db } }));

import { executePlan, resolveRange, type QueryPlan } from '@/lib/pulse/assistant';

const NOW = new Date('2026-11-26T12:00:00.000Z');

function ev(day: string, time: string, sessionId: string, visitId: string, urlPath = '/') {
  return {
    createdAt: new Date(`${day}T${time}.000Z`),
    sessionId,
    visitId,
    urlPath,
    referrerDomain: 'google',
  };
}

describe('COR-1: resolveRange uses UTC day boundaries', () => {
  it('starts lastNDays at a UTC midnight', () => {
    const range = resolveRange({ range: 'lastNDays', days: 2 }, NOW);
    expect(range.startAt.toISOString()).toBe('2026-11-25T00:00:00.000Z');
    expect(range.endAt.toISOString()).toBe('2026-11-27T00:00:00.000Z');
  });

  it('starts thisMonth on the first of the month in UTC', () => {
    const range = resolveRange({ range: 'thisMonth' }, NOW);
    expect(range.startAt.toISOString()).toBe('2026-11-01T00:00:00.000Z');
  });
});

describe('COR-2: executePlan uses the requested metric', () => {
  it('trend with metric visits counts distinct visits per day, including boundary days', async () => {
    mocks.db.websiteEvent.findMany.mockImplementation(async () => [
      ev('2026-11-25', '01:00:00', 's1', 'v1'),
      ev('2026-11-25', '02:00:00', 's1', 'v1'),
      ev('2026-11-25', '03:00:00', 's2', 'v2'),
      ev('2026-11-26', '23:00:00', 's3', 'v3'),
    ]);
    const plan: QueryPlan = {
      intent: 'trend',
      metric: 'visits',
      dimension: 'day',
      range: 'lastNDays',
      days: 2,
      limit: 31,
    };
    const result = await executePlan('site-1', plan, NOW);
    expect(result.rows).toEqual([
      { name: '2026-11-25', value: 2 },
      { name: '2026-11-26', value: 1 },
    ]);
    expect(result.total).toBe(3);
  });

  it('trend with metric bounceRate returns per-day bounce percentages', async () => {
    mocks.db.websiteEvent.findMany.mockImplementation(async () => [
      ev('2026-11-25', '01:00:00', 's1', 'v1'),
      ev('2026-11-25', '02:00:00', 's1', 'v1'),
      ev('2026-11-25', '03:00:00', 's2', 'v2'),
      ev('2026-11-26', '23:00:00', 's3', 'v3'),
    ]);
    const plan: QueryPlan = {
      intent: 'trend',
      metric: 'bounceRate',
      dimension: 'day',
      range: 'lastNDays',
      days: 2,
      limit: 31,
    };
    const result = await executePlan('site-1', plan, NOW);
    // Day 1: s1 has 2 pageviews, s2 has 1 -> 50%. Day 2: s3 single -> 100%.
    expect(result.rows).toEqual([
      { name: '2026-11-25', value: 50 },
      { name: '2026-11-26', value: 100 },
    ]);
  });

  it('top with metric visitors counts distinct sessions per page and totals the whole period', async () => {
    mocks.db.websiteEvent.findMany.mockImplementation(async () => [
      ev('2026-11-25', '01:00:00', 's1', 'v1', '/a'),
      ev('2026-11-25', '02:00:00', 's1', 'v1', '/a'),
      ev('2026-11-25', '03:00:00', 's2', 'v2', '/a'),
      ev('2026-11-25', '04:00:00', 's3', 'v3', '/b'),
      ev('2026-11-25', '05:00:00', 's4', 'v4', '/c'),
    ]);
    const plan: QueryPlan = {
      intent: 'top',
      metric: 'visitors',
      dimension: 'page',
      range: 'lastNDays',
      days: 2,
      limit: 2,
    };
    const result = await executePlan('site-1', plan, NOW);
    expect(result.rows[0]).toEqual({ name: '/a', value: 2 });
    // Total is the period-wide distinct visitor count (4), not the
    // sum of the two returned rows (3).
    expect(result.total).toBe(4);
  });
});

describe('FIN-7: topic refusals apply before the LLM path', () => {
  it('unsupportedTopic flags refused topics and clears normal questions', async () => {
    const { unsupportedTopic } = await import('@/lib/pulse/assistant');
    expect(unsupportedTopic('What was my revenue last week?')).toMatch(/revenue/);
    expect(unsupportedTopic('Delete my old data')).toMatch(/read-only/);
    expect(unsupportedTopic('How many visitors came from Google?')).toBeNull();
  });

  it('askPulse refuses a revenue question even with an LLM key configured', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                intent: 'summary',
                metric: 'pageviews',
                dimension: 'none',
                range: 'lastNDays',
                days: 7,
                limit: 10,
              }),
            },
          },
        ],
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    try {
      const { askPulse } = await import('@/lib/pulse/assistant');
      const res = await askPulse('site-1', 'Show me revenue by day');
      expect(res.status).toBe('refused');
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      delete process.env.OPENAI_API_KEY;
      vi.unstubAllGlobals();
    }
  });
});
