import { getPeriodStats, pulseDb } from '@/lib/pulse/stats';
import { parseRequest } from '@/lib/request';
import { json } from '@/lib/response';

// Cross-site roll-up: combined stats for every website the signed-in user
// can access, a per-site comparison, and a combined daily trend.
export async function GET(request: Request) {
  const { auth, error } = await parseRequest(request);
  if (error) return error();

  const url = new URL(request.url);
  const days = Math.min(365, Math.max(1, Number(url.searchParams.get('days')) || 30));
  const endAt = new Date();
  const startAt = new Date(endAt.getTime() - days * 86400_000);

  const db = pulseDb();
  const user: any = (auth as any).user;

  const websites = await db.website.findMany({
    where: {
      deletedAt: null,
      ...(user?.isAdmin
        ? {}
        : { OR: [{ userId: user.id }, { createdBy: user.id }] }),
    },
    select: { id: true, name: true, domain: true },
    orderBy: { name: 'asc' },
  });

  const perSite = [];
  const totals = { pageviews: 0, visitors: 0, visits: 0, bounces: 0, bounceRate: 0 };

  for (const site of websites as any[]) {
    const stats = await getPeriodStats(site.id, startAt, endAt);
    perSite.push({ websiteId: site.id, name: site.name, domain: site.domain, ...stats });
    totals.pageviews += stats.pageviews;
    totals.visitors += stats.visitors;
    totals.visits += stats.visits;
    totals.bounces += stats.bounces;
  }
  totals.bounceRate = totals.visitors ? Math.round((totals.bounces / totals.visitors) * 100) : 0;

  // Combined daily trend of pageviews across all sites.
  const websiteIds = websites.map((w: any) => w.id);
  const trendMap = new Map<string, number>();
  if (websiteIds.length) {
    const events = await db.websiteEvent.findMany({
      where: {
        websiteId: { in: websiteIds },
        eventType: 1,
        createdAt: { gte: startAt, lt: endAt },
      },
      select: { createdAt: true },
      take: 500000,
    });
    for (const e of events as any[]) {
      const day = new Date(e.createdAt).toISOString().slice(0, 10);
      trendMap.set(day, (trendMap.get(day) || 0) + 1);
    }
  }
  const trend = [...trendMap.entries()]
    .map(([date, pageviews]) => ({ date, pageviews }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  return json({ days, totals, perSite, trend });
}
