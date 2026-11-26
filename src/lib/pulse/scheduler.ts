import { uuid } from '@/lib/crypto';
import { evaluateAllAlerts, sendDueReports } from './engine';
import { runRetentionCleanup } from './retention';
import { pulseDb } from './stats';
import { runDueUptimeChecks } from './uptime';

// Built-in Pulse scheduler: an in-process ticker (started from Next
// instrumentation in the Node runtime) that runs the periodic Pulse jobs —
// alert evaluation, due scheduled reports, uptime checks and retention
// cleanup. A lease row in pulse_scheduler_state makes sure only one server
// instance ticks at a time. The /api/pulse/cron/* endpoints remain as manual
// fallbacks.

export const SCHEDULER_JOBS = ['alerts', 'reports', 'uptime', 'retention'] as const;
export type SchedulerJob = (typeof SCHEDULER_JOBS)[number];

const CONFIG_ID = 'global';
const LEASE_JOB = '_lease';
const LEASE_MS = 90_000;
const TICK_MS = 30_000;
// Uptime has no job-level interval: each monitor carries its own
// intervalMinutes, and runDueUptimeChecks picks the due ones. The job itself
// is evaluated on every tick.
const UPTIME_TICK_INTERVAL_MS = TICK_MS;

const instanceId = `sched-${uuid()}`;

export function isJobDue(lastRunAtMs: number | null, intervalMs: number, nowMs: number): boolean {
  if (intervalMs <= 0) return true;
  const last = lastRunAtMs || 0;
  return nowMs - last >= intervalMs;
}

export async function getSchedulerConfig() {
  const row = await pulseDb().pulseSchedulerConfig.findUnique({ where: { id: CONFIG_ID } });
  return {
    enabled: row?.enabled ?? true,
    alertsIntervalMinutes: row?.alertsIntervalMinutes ?? 5,
    reportsIntervalMinutes: row?.reportsIntervalMinutes ?? 1,
    retentionIntervalHours: row?.retentionIntervalHours ?? 24,
  };
}

function jobIntervalMs(job: SchedulerJob, config: Awaited<ReturnType<typeof getSchedulerConfig>>) {
  switch (job) {
    case 'alerts':
      return Math.max(1, config.alertsIntervalMinutes) * 60_000;
    case 'reports':
      return Math.max(1, config.reportsIntervalMinutes) * 60_000;
    case 'retention':
      return Math.max(1, config.retentionIntervalHours) * 3600_000;
    case 'uptime':
      return UPTIME_TICK_INTERVAL_MS;
  }
}

async function acquireLease(nowMs: number): Promise<boolean> {
  const db = pulseDb();
  const now = new Date(nowMs);
  const expires = new Date(nowMs + LEASE_MS);

  await db.pulseSchedulerState.upsert({
    where: { job: LEASE_JOB },
    create: { job: LEASE_JOB },
    update: {},
  });

  const res = await db.pulseSchedulerState.updateMany({
    where: {
      job: LEASE_JOB,
      OR: [
        { leaseExpiresAt: null },
        { leaseExpiresAt: { lt: now } },
        { leaseOwner: instanceId },
      ],
    },
    data: { leaseOwner: instanceId, leaseExpiresAt: expires },
  });

  return res.count > 0;
}

// COR-5: extend the lease while a tick is still running. Without
// renewal, a tick lasting longer than LEASE_MS (realistic: alert
// evaluation loads large stats ranges) let a second instance acquire
// the expired lease mid-tick and run the same due jobs again.
export async function renewLease(nowMs: number): Promise<boolean> {
  const res = await pulseDb().pulseSchedulerState.updateMany({
    where: { job: LEASE_JOB, leaseOwner: instanceId },
    data: { leaseExpiresAt: new Date(nowMs + LEASE_MS) },
  });
  return res.count > 0;
}

async function runJob(job: SchedulerJob, nowMs: number): Promise<{ items: number; detail: string }> {
  switch (job) {
    case 'alerts': {
      const logs = await evaluateAllAlerts();
      const fired = logs.filter((l: any) => l.fired).length;
      return { items: logs.length, detail: `${logs.length} rule(s) evaluated, ${fired} fired` };
    }
    case 'reports': {
      const sent = await sendDueReports();
      return { items: sent.length, detail: `${sent.length} report(s) sent` };
    }
    case 'uptime': {
      const checks = await runDueUptimeChecks(nowMs);
      return { items: checks.length, detail: `${checks.length} monitor check(s) performed` };
    }
    case 'retention': {
      const settings = await pulseDb().pulseSiteSetting.findMany({
        where: { retentionDays: { gt: 0 } },
        select: { websiteId: true },
      });
      let events = 0;
      for (const s of settings) {
        const result = await runRetentionCleanup(s.websiteId, nowMs);
        events += result.eventsDeleted;
      }
      return {
        items: events,
        detail: `${settings.length} site(s) with retention, ${events} event(s) deleted`,
      };
    }
  }
}

export async function runSchedulerJobNow(job: SchedulerJob, nowMs = Date.now()) {
  const db = pulseDb();
  const config = await getSchedulerConfig();
  const intervalMs = jobIntervalMs(job, config);

  let ok = true;
  let items = 0;
  let detail = '';
  try {
    const result = await runJob(job, nowMs);
    items = result.items;
    detail = result.detail;
  } catch (e: any) {
    ok = false;
    detail = String(e?.message || e).slice(0, 900);
  }

  await db.pulseSchedulerLog.create({
    data: { id: uuid(), job, ok, items, detail },
  });
  await db.pulseSchedulerState.upsert({
    where: { job },
    create: {
      job,
      lastRunAt: new Date(nowMs),
      nextDueAt: new Date(nowMs + intervalMs),
      lastResult: detail.slice(0, 500),
    },
    update: {
      lastRunAt: new Date(nowMs),
      nextDueAt: new Date(nowMs + intervalMs),
      lastResult: detail.slice(0, 500),
    },
  });

  return { job, ok, items, detail };
}

export async function runSchedulerTick(nowMs = Date.now()) {
  const config = await getSchedulerConfig();
  if (!config.enabled) return { skipped: 'disabled' as const, ran: [] as string[] };

  if (!(await acquireLease(nowMs))) return { skipped: 'lease' as const, ran: [] as string[] };

  // COR-5: heartbeat-renew the lease for the whole tick: on an
  // interval well under LEASE_MS (covers one long-running job) and
  // again before every job (covers a tick of several shorter jobs).
  const heartbeat = setInterval(() => {
    renewLease(Date.now()).catch(() => undefined);
  }, LEASE_MS / 3);
  (heartbeat as any).unref?.();

  const db = pulseDb();
  const ran: string[] = [];

  try {
    for (const job of SCHEDULER_JOBS) {
      await renewLease(Date.now());
      const state = await db.pulseSchedulerState.findUnique({ where: { job } });
      const intervalMs = jobIntervalMs(job, config);
      const lastMs = state?.lastRunAt ? new Date(state.lastRunAt).getTime() : null;
      if (!isJobDue(lastMs, intervalMs, nowMs)) continue;
      await runSchedulerJobNow(job, nowMs);
      ran.push(job);
    }
  } finally {
    clearInterval(heartbeat);
  }

  return { skipped: null, ran };
}

export async function getSchedulerStatus() {
  const db = pulseDb();
  const [config, states, logs] = await Promise.all([
    getSchedulerConfig(),
    db.pulseSchedulerState.findMany({ where: { job: { in: [...SCHEDULER_JOBS] } } }),
    db.pulseSchedulerLog.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
  ]);

  const byJob = new Map(states.map((s: any) => [s.job, s]));
  const jobs = SCHEDULER_JOBS.map(job => {
    const s: any = byJob.get(job);
    return {
      job,
      intervalMs: jobIntervalMs(job, config),
      lastRunAt: s?.lastRunAt || null,
      nextDueAt: s?.nextDueAt || null,
      lastResult: s?.lastResult || null,
    };
  });

  return { config, jobs, logs, instanceId };
}

let started = false;

export function startScheduler() {
  if (started) return;
  started = true;
  const tick = () => {
    runSchedulerTick().catch(e => {
      // The scheduler must never take the server down with it.
      console.error('[pulse-scheduler] tick failed:', e);
    });
  };
  setTimeout(tick, 10_000);
  setInterval(tick, TICK_MS);
}
