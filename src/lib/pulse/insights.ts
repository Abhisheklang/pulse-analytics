import prisma from '@/lib/prisma';
import { getPeriodStats, getSessionDimensionCounts } from './stats';

const db = () => (prisma as any).client;

export interface Insight {
  type: string;
  title: string;
  detail: string;
}

// Pure helper (unit-tested): from current/previous period counts, pick the
// name with the largest positive delta. Names in `exclude` (notably
// '(direct)') never win — direct traffic is not a referrer driver.
export function pickTopDriver(
  cur: Map<string, number>,
  prev: Map<string, number>,
  exclude: string[] = ['(direct)'],
): { name: string; delta: number; cur: number; prev: number } | null {
  let best: { name: string; delta: number; cur: number; prev: number } | null = null;
  for (const name of new Set([...cur.keys(), ...prev.keys()])) {
    if (exclude.includes(name)) continue;
    const c = cur.get(name) || 0;
    const p = prev.get(name) || 0;
    const delta = c - p;
    if (delta > 0 && (!best || delta > best.delta)) best = { name, delta, cur: c, prev: p };
  }
  return best;
}

async function topByField(
  websiteId: string,
  startAt: Date,
  endAt: Date,
  field: string,
  limit = 30,
): Promise<Map<string, number>> {
  const rows = await db().websiteEvent.groupBy({
    by: [field],
    where: { websiteId, eventType: 1, createdAt: { gte: startAt, lt: endAt } },
    _count: { _all: true },
    orderBy: { _count: { [field]: 'desc' } },
    take: limit,
  });

  const map = new Map<string, number>();
  for (const r of rows as any[]) {
    map.set(r[field] || '(direct)', r._count._all);
  }
  return map;
}

export async function buildInsights(websiteId: string, days = 7): Promise<Insight[]> {
  const now = new Date();
  const start = new Date(now.getTime() - days * 86400_000);
  const prevStart = new Date(now.getTime() - days * 2 * 86400_000);

  const insights: Insight[] = [];

  const [curStats, prevStats] = await Promise.all([
    getPeriodStats(websiteId, start, now),
    getPeriodStats(websiteId, prevStart, start),
  ]);

  if (prevStats.pageviews > 0) {
    const pct = ((curStats.pageviews - prevStats.pageviews) / prevStats.pageviews) * 100;
    if (Math.abs(pct) >= 10) {
      insights.push({
        type: 'traffic-change',
        title: `Traffic ${pct > 0 ? 'rose' : 'fell'} ${Math.abs(pct).toFixed(0)}%`,
        detail: `Pageviews went from ${prevStats.pageviews} to ${curStats.pageviews} versus the previous ${days} days. Visitors moved from ${prevStats.visitors} to ${curStats.visitors}.`,
      });
    }
  }

  if (curStats.bounceRate !== prevStats.bounceRate && curStats.visitors >= 3) {
    const diff = curStats.bounceRate - prevStats.bounceRate;
    if (Math.abs(diff) >= 10) {
      insights.push({
        type: 'bounce-change',
        title: `Bounce rate ${diff > 0 ? 'increased' : 'improved'} by ${Math.abs(diff)} points`,
        detail: `Bounce rate is ${curStats.bounceRate}% now versus ${prevStats.bounceRate}% in the previous period.`,
      });
    }
  }

  // Page gainers / losers
  const [curPages, prevPages] = await Promise.all([
    topByField(websiteId, start, now, 'urlPath'),
    topByField(websiteId, prevStart, start, 'urlPath'),
  ]);

  let bestGainer: { name: string; delta: number; cur: number; prev: number } | null = null;
  let bestLoser: typeof bestGainer = null;

  for (const name of new Set([...curPages.keys(), ...prevPages.keys()])) {
    const cur = curPages.get(name) || 0;
    const prev = prevPages.get(name) || 0;
    const delta = cur - prev;
    if (delta > 0 && (!bestGainer || delta > bestGainer.delta)) bestGainer = { name, delta, cur, prev };
    if (delta < 0 && (!bestLoser || delta < bestLoser.delta)) bestLoser = { name, delta, cur, prev };
  }

  if (bestGainer && bestGainer.delta >= 2) {
    insights.push({
      type: 'page-gainer',
      title: `${bestGainer.name} is your fastest-growing page`,
      detail: `It gained ${bestGainer.delta} views (${bestGainer.prev} -> ${bestGainer.cur}) compared with the previous period.`,
    });
  }

  if (bestLoser && bestLoser.delta <= -2) {
    insights.push({
      type: 'page-loser',
      title: `${bestLoser.name} lost traffic`,
      detail: `It dropped ${Math.abs(bestLoser.delta)} views (${bestLoser.prev} -> ${bestLoser.cur}) compared with the previous period.`,
    });
  }

  // Referrer drivers
  const [curRefs, prevRefs] = await Promise.all([
    topByField(websiteId, start, now, 'referrerDomain'),
    topByField(websiteId, prevStart, start, 'referrerDomain'),
  ]);

  const bestRef = pickTopDriver(curRefs, prevRefs);

  if (bestRef && bestRef.delta >= 2) {
    insights.push({
      type: 'referrer-driver',
      title: `${bestRef.name} drove the growth`,
      detail: `Referrals from ${bestRef.name} increased by ${bestRef.delta} views (${bestRef.prev} -> ${bestRef.cur}) period over period.`,
    });
  }

  // Device shift
  const [curDev, prevDev] = await Promise.all([
    getSessionDimensionCounts(websiteId, start, now, 'device'),
    getSessionDimensionCounts(websiteId, prevStart, start, 'device'),
  ]);

  const curTotal = [...curDev.values()].reduce((a, b) => a + b, 0);
  const prevTotal = [...prevDev.values()].reduce((a, b) => a + b, 0);

  if (curTotal >= 3 && prevTotal >= 3) {
    for (const device of new Set([...curDev.keys(), ...prevDev.keys()])) {
      const curShare = ((curDev.get(device) || 0) / curTotal) * 100;
      const prevShare = ((prevDev.get(device) || 0) / prevTotal) * 100;
      if (Math.abs(curShare - prevShare) >= 15) {
        insights.push({
          type: 'device-shift',
          title: `${device} share shifted to ${curShare.toFixed(0)}%`,
          detail: `${device} devices were ${prevShare.toFixed(0)}% of sessions last period and ${curShare.toFixed(0)}% now.`,
        });
        break;
      }
    }
  }

  // Country leader
  const countries = await getSessionDimensionCounts(websiteId, start, now, 'country');
  const topCountry = [...countries.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topCountry && curTotal >= 3) {
    insights.push({
      type: 'top-country',
      title: `${topCountry[0]} is your top country`,
      detail: `${topCountry[1]} of ${curTotal} sessions in the current period came from ${topCountry[0]}.`,
    });
  }

  // Annotation correlation
  const annotations = await db().annotation.findMany({
    where: { websiteId, date: { gte: start, lt: now } },
    orderBy: { date: 'asc' },
  });

  for (const a of annotations.slice(0, 2)) {
    insights.push({
      type: 'annotation',
      title: `Annotation in this period: "${a.note}"`,
      detail: `Marked on ${new Date(a.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}. Compare traffic before and after this date to judge its impact.`,
    });
  }

  return insights;
}
