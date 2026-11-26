import { uuid } from '@/lib/crypto';
import { deliverToChannel } from './deliver';
import { pulseDb } from './stats';
import { checkPublicUrl } from './url-guard';

const db = () => pulseDb();

const MAX_REDIRECTS = 5;

// SSRF-guarded GET for uptime monitors: the monitor URL is user-supplied,
// so redirects are followed manually and every hop (including each
// redirect target) is re-checked against the public-address guard.
async function fetchMonitorUrl(startUrl: string): Promise<{ status: number }> {
  let currentUrl = startUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const blocked = await checkPublicUrl(currentUrl);
    if (blocked) throw new Error(blocked);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    let res: Response;
    try {
      res = await fetch(currentUrl, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: { 'user-agent': 'PulseUptimeCheck/1.0' },
      });
    } finally {
      clearTimeout(timer);
    }

    const location = res.headers.get('location');
    // Drain the body so the socket can close cleanly.
    await res.text().catch(() => '');

    if (res.status >= 300 && res.status < 400 && location) {
      if (hop === MAX_REDIRECTS) throw new Error('Too many redirects');
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }

    return { status: res.status };
  }

  throw new Error('Too many redirects');
}

export async function performCheck(monitor: any) {
  const started = Date.now();
  let up = false;
  let status: number | null = null;
  let error: string | null = null;

  try {
    const result = await fetchMonitorUrl(monitor.url);
    status = result.status;
    up = status >= 200 && status < 400;
    if (!up) error = `HTTP ${status}`;
  } catch (e: any) {
    error = e?.name === 'AbortError' ? 'timeout after 10s' : String(e?.message || e);
  }

  const responseMs = Date.now() - started;

  const check = await db().pulseUptimeCheck.create({
    data: {
      id: uuid(),
      monitorId: monitor.id,
      websiteId: monitor.websiteId,
      up,
      status,
      responseMs,
      error,
    },
  });

  // Incident transitions: open on failure (when none open), close on recovery.
  const open = await db().pulseUptimeIncident.findFirst({
    where: { monitorId: monitor.id, endedAt: null },
    orderBy: { startedAt: 'desc' },
  });

  let incident = null;

  if (!up && !open) {
    incident = await db().pulseUptimeIncident.create({
      data: { id: uuid(), monitorId: monitor.id, websiteId: monitor.websiteId },
    });

    if (monitor.notifyWebhookUrl) {
      const result = await deliverToChannel(
        { channel: 'webhook', webhookUrl: monitor.notifyWebhookUrl },
        {
          title: 'Pulse uptime: site is DOWN',
          text: `${monitor.url} is down (${error || 'check failed'}, ${responseMs}ms).`,
          extra: {
            source: 'pulse-uptime',
            websiteId: monitor.websiteId,
            url: monitor.url,
            status,
            error,
            incidentId: incident.id,
          },
        },
      );
      await db().pulseUptimeIncident.update({
        where: { id: incident.id },
        data: { notified: result.ok },
      });
      incident = { ...incident, notified: result.ok };
    }
  } else if (up && open) {
    incident = await db().pulseUptimeIncident.update({
      where: { id: open.id },
      data: { endedAt: new Date() },
    });
  }

  return { check, incident };
}

export async function runAllUptimeChecks(websiteId?: string) {
  const monitors = await db().pulseUptimeMonitor.findMany({
    where: { enabled: true, ...(websiteId ? { websiteId } : {}) },
  });

  const results = [];
  for (const monitor of monitors) {
    results.push(await performCheck(monitor));
  }
  return results;
}

// Scheduler variant: only run monitors whose own interval has elapsed since
// their most recent check (monitors that have never been checked are due).
export async function runDueUptimeChecks(nowMs = Date.now()) {
  const monitors = await db().pulseUptimeMonitor.findMany({ where: { enabled: true } });
  const results = [];

  for (const monitor of monitors) {
    const last = await db().pulseUptimeCheck.findFirst({
      where: { monitorId: monitor.id },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    const lastMs = last?.createdAt ? new Date(last.createdAt).getTime() : 0;
    const intervalMs = Math.max(1, monitor.intervalMinutes || 5) * 60_000;
    if (nowMs - lastMs >= intervalMs) {
      results.push(await performCheck(monitor));
    }
  }
  return results;
}

export async function getUptimeSummary(websiteId: string) {
  const now = Date.now();
  const dayAgo = new Date(now - 86400_000);
  const monthAgo = new Date(now - 30 * 86400_000);

  const [monitor, recentChecks, incidents, checks24h, checks30d] = await Promise.all([
    db().pulseUptimeMonitor.findUnique({ where: { websiteId } }),
    db().pulseUptimeCheck.findMany({
      where: { websiteId },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
    db().pulseUptimeIncident.findMany({
      where: { websiteId },
      orderBy: { startedAt: 'desc' },
      take: 20,
    }),
    db().pulseUptimeCheck.findMany({
      where: { websiteId, createdAt: { gte: dayAgo } },
      select: { up: true },
    }),
    db().pulseUptimeCheck.findMany({
      where: { websiteId, createdAt: { gte: monthAgo } },
      select: { up: true },
    }),
  ]);

  const pct = (rows: any[]) =>
    rows.length ? Math.round((rows.filter(r => r.up).length / rows.length) * 10000) / 100 : null;

  const lastCheck = recentChecks[0] || null;

  return {
    monitor,
    currentStatus: lastCheck ? (lastCheck.up ? 'up' : 'down') : 'unknown',
    lastCheck,
    recentChecks,
    incidents,
    uptime24h: pct(checks24h),
    uptime30d: pct(checks30d),
    checks24h: checks24h.length,
    checks30d: checks30d.length,
  };
}
