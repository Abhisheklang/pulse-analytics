import { getPeriodStats, pulseDb } from './stats';

const db = () => pulseDb();

export const SPAM_DOMAINS = [
  'semalt.com',
  'buttons-for-website.com',
  'free-share-buttons.com',
  'darodar.com',
  'ilovevitaly.com',
  'priceg.com',
  'blackhatworth.com',
  'hulfingtonpost.com',
  'o-o-6-o-o.com',
  'best-seo-offer.com',
];

const BROKEN_PATTERNS = ['404', 'not-found', 'not_found', 'notfound', '/error', 'page-not-found'];

export function isBrokenPage(urlPath: string, pageTitle?: string | null): boolean {
  const path = (urlPath || '').toLowerCase();
  const title = (pageTitle || '').toLowerCase();

  return (
    BROKEN_PATTERNS.some(p => path.includes(p)) ||
    title.includes('404') ||
    title.includes('not found') ||
    title.includes('page not found')
  );
}

export async function buildQualityReport(websiteId: string, days = 30) {
  const now = new Date();
  const start = new Date(now.getTime() - days * 86400_000);

  const events = await db().websiteEvent.findMany({
    where: { websiteId, eventType: 1, createdAt: { gte: start, lt: now } },
    select: { urlPath: true, pageTitle: true, referrerDomain: true, sessionId: true },
  });

  const stats = await getPeriodStats(websiteId, start, now);

  const broken = events.filter((e: any) => isBrokenPage(e.urlPath, e.pageTitle));

  const brokenByPage = new Map<string, number>();
  const brokenReferrers = new Map<string, number>();
  for (const e of broken as any[]) {
    brokenByPage.set(e.urlPath, (brokenByPage.get(e.urlPath) || 0) + 1);
    const ref = e.referrerDomain || '(direct)';
    brokenReferrers.set(ref, (brokenReferrers.get(ref) || 0) + 1);
  }

  const noReferrer = events.filter((e: any) => !e.referrerDomain).length;

  // Bounce-heavy pages: pages whose sessions usually have exactly 1 pageview
  const sessionPages = new Map<string, Set<string>>();
  for (const e of events as any[]) {
    if (!sessionPages.has(e.sessionId)) sessionPages.set(e.sessionId, new Set());
    sessionPages.get(e.sessionId)!.add(e.urlPath);
  }

  const pageSessions = new Map<string, { sessions: number; single: number }>();
  const sessionEventCount = new Map<string, number>();
  for (const e of events as any[]) {
    sessionEventCount.set(e.sessionId, (sessionEventCount.get(e.sessionId) || 0) + 1);
  }
  for (const e of events as any[]) {
    const entry = pageSessions.get(e.urlPath) || { sessions: 0, single: 0 };
    entry.sessions++;
    if (sessionEventCount.get(e.sessionId) === 1) entry.single++;
    pageSessions.set(e.urlPath, entry);
  }

  const bounceHeavyPages = [...pageSessions.entries()]
    .map(([name, v]) => ({ name, sessions: v.sessions, bounceRate: Math.round((v.single / v.sessions) * 100) }))
    .filter(p => p.sessions >= 2 && p.bounceRate >= 80)
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 5);

  const referrerCounts = new Map<string, number>();
  for (const e of events as any[]) {
    if (e.referrerDomain) {
      referrerCounts.set(e.referrerDomain, (referrerCounts.get(e.referrerDomain) || 0) + 1);
    }
  }

  const topReferrers = [...referrerCounts.entries()]
    .map(([name, count]) => ({ name, count, spam: SPAM_DOMAINS.includes(name) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const sortDesc = (m: Map<string, number>, limit: number) =>
    [...m.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, limit);

  return {
    periodDays: days,
    totalPageviews: stats.pageviews,
    totalSessions: stats.visitors,
    brokenPages: sortDesc(brokenByPage, 10),
    brokenViews: broken.length,
    brokenShare: stats.pageviews ? Math.round((broken.length / stats.pageviews) * 100) : 0,
    brokenReferrers: sortDesc(brokenReferrers, 5),
    noReferrerViews: noReferrer,
    noReferrerShare: stats.pageviews ? Math.round((noReferrer / stats.pageviews) * 100) : 0,
    bounceHeavyPages,
    topReferrers,
    spamReferrers: topReferrers.filter(r => r.spam),
  };
}
