import { beforeEach, describe, expect, it, vi } from 'vitest';

// COR-5 regression: the scheduler lease must be renewed while a tick
// runs. The Prisma client behind pulseDb() and the job runners are
// mocked with an in-memory lease row that follows the real
// acquireLease semantics, so a second instance's acquire attempt can
// be replayed against the row state the tick leaves behind.

const mocks = vi.hoisted(() => ({
  leaseRow: null as null | { leaseOwner: string | null; leaseExpiresAt: Date | null },
  leaseUpdateCalls: [] as any[],
  db: null as any,
  evaluateAllAlerts: vi.fn(),
  sendDueReports: vi.fn(),
  runDueUptimeChecks: vi.fn(),
  runRetentionCleanup: vi.fn(),
}));

vi.mock('@/lib/pulse/stats', () => ({
  pulseDb: () => mocks.db,
}));

vi.mock('@/lib/pulse/engine', () => ({
  evaluateAllAlerts: mocks.evaluateAllAlerts,
  sendDueReports: mocks.sendDueReports,
}));

vi.mock('@/lib/pulse/uptime', () => ({
  runDueUptimeChecks: mocks.runDueUptimeChecks,
}));

vi.mock('@/lib/pulse/retention', () => ({
  runRetentionCleanup: mocks.runRetentionCleanup,
}));

import { isJobDue, renewLease, runSchedulerTick } from '../scheduler';

describe('isJobDue', () => {
  const now = Date.parse('2026-11-14T12:00:00.000Z');
  const minute = 60_000;

  it('a job that never ran is due', () => {
    expect(isJobDue(null, 5 * minute, now)).toBe(true);
  });

  it('a job inside its interval is not due', () => {
    expect(isJobDue(now - 4 * minute, 5 * minute, now)).toBe(false);
  });

  it('a job past its interval is due', () => {
    expect(isJobDue(now - 6 * minute, 5 * minute, now)).toBe(true);
  });

  it('exactly at the interval boundary is due', () => {
    expect(isJobDue(now - 5 * minute, 5 * minute, now)).toBe(true);
  });

  it('a non-positive interval always runs', () => {
    expect(isJobDue(now, 0, now)).toBe(true);
  });
});

function installFakeDb() {
  mocks.leaseRow = { leaseOwner: null, leaseExpiresAt: null };
  mocks.leaseUpdateCalls = [];
  mocks.db = {
    pulseSchedulerConfig: {
      findUnique: vi.fn(async () => ({
        enabled: true,
        alertsIntervalMinutes: 5,
        reportsIntervalMinutes: 1,
        retentionIntervalHours: 24,
      })),
    },
    pulseSchedulerState: {
      upsert: vi.fn(async () => ({})),
      findUnique: vi.fn(async () => null),
      findMany: vi.fn(async () => []),
      updateMany: vi.fn(async ({ where, data }: any) => {
        if (where.job !== '_lease') return { count: 0 };
        mocks.leaseUpdateCalls.push({ where, data });
        const row = mocks.leaseRow!;
        if (where.leaseOwner && !where.OR) {
          // renewLease: only the current owner can extend.
          if (row.leaseOwner !== where.leaseOwner) return { count: 0 };
          row.leaseExpiresAt = data.leaseExpiresAt;
          return { count: 1 };
        }
        // acquireLease semantics from scheduler.ts.
        const now = where.OR[1].leaseExpiresAt.lt as Date;
        const self = where.OR[2].leaseOwner as string;
        if (
          row.leaseExpiresAt === null ||
          row.leaseExpiresAt < now ||
          row.leaseOwner === self
        ) {
          row.leaseOwner = data.leaseOwner;
          row.leaseExpiresAt = data.leaseExpiresAt;
          return { count: 1 };
        }
        return { count: 0 };
      }),
    },
    pulseSchedulerLog: { create: vi.fn(async () => ({})), findMany: vi.fn(async () => []) },
    pulseSiteSetting: { findMany: vi.fn(async () => []) },
  };
}

// Replays the acquireLease WHERE clause for a different instance at
// the given time against the fake lease row.
function secondInstanceCanAcquire(atMs: number): boolean {
  const row = mocks.leaseRow!;
  return row.leaseExpiresAt === null || row.leaseExpiresAt.getTime() < atMs;
}

describe('COR-5: scheduler lease renewal during a tick', () => {
  beforeEach(() => {
    installFakeDb();
    mocks.evaluateAllAlerts.mockReset().mockResolvedValue([]);
    mocks.sendDueReports.mockReset().mockResolvedValue([]);
    mocks.runDueUptimeChecks.mockReset().mockResolvedValue([]);
    mocks.runRetentionCleanup.mockReset().mockResolvedValue({ eventsDeleted: 0 });
  });

  it('renews the lease during the tick so it stays valid past the original 90s expiry', async () => {
    vi.useFakeTimers();
    try {
      const t0 = Date.parse('2026-11-14T12:00:00.000Z');
      vi.setSystemTime(t0);

      // The alerts job blocks: the tick is still running at t0+91s,
      // exactly the verdict reproducer's setup.
      let releaseAlerts!: () => void;
      mocks.evaluateAllAlerts.mockReset().mockImplementation(
        () =>
          new Promise<any[]>(resolve => {
            releaseAlerts = () => resolve([]);
          }),
      );

      const tickPromise = runSchedulerTick(t0);
      // Let the tick acquire the lease and enter the blocked job,
      // then run the clock 91s forward: the heartbeat (LEASE_MS / 3)
      // fires at 30s, 60s and 90s and renews the lease each time.
      await vi.advanceTimersByTimeAsync(91_000);

      const renewals = mocks.leaseUpdateCalls.filter(c => c.where.leaseOwner && !c.where.OR);
      expect(renewals.length).toBeGreaterThanOrEqual(1);
      // The last renewal pushed expiry to about t0+90s+90s, so a
      // second instance can no longer acquire at t0+91s mid-tick
      // (the verdict reproducer got 2 duplicate deliveries here).
      expect(mocks.leaseRow!.leaseExpiresAt!.getTime()).toBeGreaterThan(t0 + 91_000);
      expect(secondInstanceCanAcquire(t0 + 91_000)).toBe(false);

      releaseAlerts();
      const result = await tickPromise;
      expect(result.skipped).toBeNull();
      expect(result.ran).toContain('alerts');
    } finally {
      vi.useRealTimers();
    }
  });

  it('renewLease only extends a lease this instance owns', async () => {
    const t0 = Date.now();
    await runSchedulerTick(t0);
    const expiryBefore = mocks.leaseRow!.leaseExpiresAt!.getTime();
    const renewed = await renewLease(t0 + 120_000);
    expect(renewed).toBe(true);
    expect(mocks.leaseRow!.leaseExpiresAt!.getTime()).toBe(t0 + 120_000 + 90_000);
    expect(mocks.leaseRow!.leaseExpiresAt!.getTime()).toBeGreaterThan(expiryBefore);
  });
});
