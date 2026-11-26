import { describe, expect, it, vi } from 'vitest';

// Regression tests for COR-3 (experiment conversions must follow the
// exposure), COR-4 (quality bounce table counts distinct sessions) and
// COR-9 (revenue currency labels are validated). Prisma is mocked.

const mocks = vi.hoisted(() => ({
  db: {
    websiteEvent: { findMany: vi.fn() },
  },
}));

vi.mock('@/lib/prisma', () => ({ default: { client: mocks.db } }));

import { getExperimentResults } from '@/lib/pulse/experiments';
import { buildQualityReport } from '@/lib/pulse/quality';
import { aggregateRevenueRows, sanitizeCurrency } from '@/lib/pulse/revenue';

const T = (s: string) => new Date(`2026-11-20T${s}.000Z`);

describe('COR-3: experiment conversions must follow exposure', () => {
  it('does not count a conversion that happened before the exposure', async () => {
    const exposure = {
      sessionId: 's1',
      createdAt: T('10:00:00'),
      eventData: [
        { dataKey: 'experiment', stringValue: 'exp1' },
        { dataKey: 'variant', stringValue: 'a' },
      ],
    };
    const exposure2 = {
      sessionId: 's2',
      createdAt: T('10:00:00'),
      eventData: [
        { dataKey: 'experiment', stringValue: 'exp1' },
        { dataKey: 'variant', stringValue: 'a' },
      ],
    };
    mocks.db.websiteEvent.findMany
      .mockResolvedValueOnce([exposure, exposure2])
      .mockResolvedValueOnce([
        // s1 converted BEFORE exposure: must not count.
        { sessionId: 's1', createdAt: T('09:00:00') },
        // s2 converted after exposure: counts.
        { sessionId: 's2', createdAt: T('11:00:00') },
      ]);

    const result = await getExperimentResults({
      websiteId: 'site-1',
      key: 'exp1',
      conversionEvent: 'buy',
      variants: [{ key: 'a', weight: 100, control: true }],
    });

    expect(result.results[0].exposures).toBe(2);
    expect(result.results[0].conversions).toBe(1);
  });
});

describe('COR-4: quality bounce table counts distinct sessions per page', () => {
  it('a session viewing one page three times counts once, and is not a bounce', async () => {
    const events = [
      { urlPath: '/a', pageTitle: '', referrerDomain: 'x.com', sessionId: 's1', visitId: 'v1' },
      { urlPath: '/a', pageTitle: '', referrerDomain: 'x.com', sessionId: 's1', visitId: 'v1' },
      { urlPath: '/a', pageTitle: '', referrerDomain: 'x.com', sessionId: 's1', visitId: 'v1' },
      { urlPath: '/a', pageTitle: '', referrerDomain: 'x.com', sessionId: 's2', visitId: 'v2' },
      { urlPath: '/a', pageTitle: '', referrerDomain: 'x.com', sessionId: 's3', visitId: 'v3' },
    ];
    mocks.db.websiteEvent.findMany.mockResolvedValue(events);

    const report = await buildQualityReport('site-1', 30);
    const page = report.bounceHeavyPages.find(p => p.name === '/a');
    // 3 distinct sessions, 2 of them single-pageview sessions: 67%.
    // The buggy version reported 5 "sessions" at 40%.
    expect(page).toBeUndefined(); // 67% is below the 80% bounce-heavy threshold
    expect(report.totalSessions).toBe(3);
  });
});

describe('COR-9: revenue currency validation', () => {
  it('sanitizeCurrency accepts ISO-shaped codes only', () => {
    expect(sanitizeCurrency('EUR', 'USD')).toBe('EUR');
    expect(sanitizeCurrency('eur', 'USD')).toBe('USD');
    expect(sanitizeCurrency('<script>alert(1)</script>', 'USD')).toBe('USD');
    expect(sanitizeCurrency('EURO', 'USD')).toBe('USD');
    expect(sanitizeCurrency(undefined, 'USD')).toBe('USD');
  });

  it('aggregateRevenueRows buckets an invalid per-event currency under the default', () => {
    const rows = [
      {
        websiteEventId: 'e1',
        numberValue: 10,
        websiteEvent: { urlPath: '/', referrerDomain: null, sessionId: 's1', createdAt: T('10:00:00') },
      },
    ] as any;
    const result = aggregateRevenueRows(rows, new Map([['e1', 'PWNED']]), 'USD');
    expect(result.currency).toBe('USD');
    expect(result.total).toBe(10);
    expect(result.otherCurrencies).toEqual([]);
  });
});
