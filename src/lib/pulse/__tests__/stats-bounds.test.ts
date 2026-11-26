import { describe, expect, it, vi } from 'vitest';

// Regression test for SEC-6: the in-memory period aggregations must
// pass a bounded take to Prisma instead of loading every pageview row
// of the period into the process.

const mocks = vi.hoisted(() => ({
  db: { websiteEvent: { findMany: vi.fn() } },
}));

vi.mock('@/lib/prisma', () => ({ default: { client: mocks.db } }));

import { buildQualityReport } from '@/lib/pulse/quality';
import { getPeriodStats, MAX_PERIOD_EVENTS } from '@/lib/pulse/stats';

describe('SEC-6: bounded in-memory stats queries', () => {
  it('getPeriodStats caps the pageview load', async () => {
    mocks.db.websiteEvent.findMany.mockResolvedValue([]);
    await getPeriodStats('site-1', new Date('2026-01-01'), new Date('2026-01-31'));
    expect(mocks.db.websiteEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: MAX_PERIOD_EVENTS }),
    );
    expect(MAX_PERIOD_EVENTS).toBe(500_000);
  });

  it('buildQualityReport caps its event load', async () => {
    mocks.db.websiteEvent.findMany.mockResolvedValue([]);
    await buildQualityReport('site-1', 30);
    for (const call of mocks.db.websiteEvent.findMany.mock.calls) {
      expect(call[0].take).toBe(MAX_PERIOD_EVENTS);
    }
  });
});
