import type { PrismaClient } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import { guardedFetch } from './url-guard';

// FIN-2: pulseDb is the generated PrismaClient type, not
// (prisma as any).client, so Pulse queries are checked against the
// Prisma schema instead of bypassing it entirely. The app's client
// wrapper adds raw-query helpers on top of the same client, hence
// the single cast at this boundary.
const db = () => prisma.client as unknown as PrismaClient;


// SEC-6: hard cap for the in-memory period aggregations below. These
// helpers load pageview rows into the Node process, and they are
// reachable by view-level and share-token callers, so an unbounded
// findMany over a busy site's period is a self-inflicted denial of
// service. 500k pageviews per period matches the largest cap already
// used elsewhere in Pulse (rollup trend, exports).
export const MAX_PERIOD_EVENTS = 500_000;

export interface PeriodStats {
  pageviews: number;
  visitors: number;
  visits: number;
  bounces: number;
  bounceRate: number;
}

export async function getPeriodStats(
  websiteId: string,
  startAt: Date,
  endAt: Date,
): Promise<PeriodStats> {
  const client = db();

  const events = await client.websiteEvent.findMany({
    where: { websiteId, eventType: 1, createdAt: { gte: startAt, lt: endAt } },
    select: { sessionId: true, visitId: true },
    take: MAX_PERIOD_EVENTS,
  });

  const sessions = new Set<string>();
  const visits = new Set<string>();
  const perSession = new Map<string, number>();

  for (const e of events) {
    sessions.add(e.sessionId);
    visits.add(e.visitId);
    perSession.set(e.sessionId, (perSession.get(e.sessionId) || 0) + 1);
  }

  let bounces = 0;
  for (const count of perSession.values()) {
    if (count === 1) bounces++;
  }

  const totalSessions = sessions.size;

  return {
    pageviews: events.length,
    visitors: totalSessions,
    visits: visits.size,
    bounces,
    bounceRate: totalSessions ? Math.round((bounces / totalSessions) * 100) : 0,
  };
}

export async function getTopGrouped(
  websiteId: string,
  startAt: Date,
  endAt: Date,
  field: 'urlPath' | 'referrerDomain',
  limit = 5,
): Promise<{ name: string; count: number }[]> {
  const client = db();

  const rows = await client.websiteEvent.groupBy({
    by: [field],
    where: { websiteId, eventType: 1, createdAt: { gte: startAt, lt: endAt } },
    _count: { _all: true },
    orderBy: { _count: { [field]: 'desc' } },
    take: limit * 2,
  });

  return rows
    .map((r: any) => ({ name: r[field] || '(direct)', count: r._count._all }))
    .filter((r: any) => r.name)
    .slice(0, limit);
}

export async function getTopCountries(
  websiteId: string,
  startAt: Date,
  endAt: Date,
  limit = 5,
): Promise<{ name: string; count: number }[]> {
  const client = db();

  const rows = await client.session.groupBy({
    by: ['country'],
    where: {
      websiteId,
      createdAt: { gte: startAt, lt: endAt },
      websiteEvents: { some: { eventType: 1 } },
    },
    _count: { _all: true },
    orderBy: { _count: { country: 'desc' } },
    take: limit,
  });

  return rows.map((r: any) => ({ name: r.country || 'Unknown', count: r._count._all }));
}

export async function getSessionDimensionCounts(
  websiteId: string,
  startAt: Date,
  endAt: Date,
  field: 'browser' | 'os' | 'device' | 'country',
): Promise<Map<string, number>> {
  const client = db();

  const rows = await client.session.groupBy({
    by: [field],
    where: { websiteId, createdAt: { gte: startAt, lt: endAt } },
    _count: { _all: true },
    orderBy: { _count: { [field]: 'desc' } },
  });

  const map = new Map<string, number>();
  for (const r of rows as any[]) {
    map.set(r[field] || 'Unknown', r._count._all);
  }
  return map;
}

export async function postWebhook(
  url: string,
  payload: Record<string, any>,
  timeoutMs = 5000,
): Promise<{ ok: boolean; status?: number; error?: string }> {
  // SSRF guard: the webhook URL is user-supplied. guardedFetch validates
  // the initial URL and re-validates every redirect hop (SEC-2); the
  // timer is cleared on every path (COR-9).
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await guardedFetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        // Slack/Discord-compatible human-readable summary
        text: payload.text || payload.message || 'Pulse Analytics notification',
      }),
      signal: controller.signal,
    });

    return { ok: res.ok, status: res.status };
  } catch (e: any) {
    return { ok: false, error: e?.name === 'AbortError' ? 'timeout' : String(e?.message || e) };
  } finally {
    clearTimeout(timer);
  }
}

export { db as pulseDb };
