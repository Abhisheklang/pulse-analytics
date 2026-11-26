import { z } from 'zod';
import { getRevenueReport } from './revenue';
import {
  getPeriodStats,
  getSessionDimensionCounts,
  getTopCountries,
  getTopGrouped,
  pulseDb,
} from './stats';

// Custom dashboards: a layout is a JSON array of widgets
// { id, type, websiteId, days, span }. Widget values are computed live from
// the same stats helpers the rest of Pulse uses, so a dashboard always
// reflects real data.

export interface DashboardWidget {
  id: string;
  type: string;
  websiteId: string;
  days: number;
  span?: number;
}

export const WIDGET_CATALOG: { type: string; label: string }[] = [
  { type: 'visitors', label: 'Visitors stat' },
  { type: 'views', label: 'Views stat' },
  { type: 'bounce', label: 'Bounce rate stat' },
  { type: 'trend', label: 'Views trend chart' },
  { type: 'top-pages', label: 'Top pages' },
  { type: 'top-referrers', label: 'Top referrers' },
  { type: 'top-countries', label: 'Top countries' },
  { type: 'devices', label: 'Devices split' },
  { type: 'revenue', label: 'Revenue total' },
  { type: 'online', label: 'Realtime online count' },
];

export const dashboardLayoutSchema = z
  .array(
    z.object({
      id: z.string().max(100),
      type: z.enum(WIDGET_CATALOG.map(w => w.type) as [string, ...string[]]),
      websiteId: z.string().uuid(),
      days: z.coerce.number().int().min(1).max(365),
      span: z.coerce.number().int().min(1).max(3).optional(),
    }),
  )
  .max(24);

const ONLINE_WINDOW_MS = 5 * 60 * 1000;

async function dailyTrend(websiteId: string, startAt: Date, endAt: Date) {
  const db = pulseDb();
  // COR-1: bucket by UTC calendar day starting at the UTC midnight of
  // the first day. Stepping 24h increments from a non-midnight start
  // merged two partial days into the first bucket under one date label.
  const start = new Date(
    Date.UTC(startAt.getUTCFullYear(), startAt.getUTCMonth(), startAt.getUTCDate()),
  );
  const events = await db.websiteEvent.findMany({
    where: { websiteId, eventType: 1, createdAt: { gte: start, lt: endAt } },
    select: { createdAt: true },
    take: 200000,
  });

  const byDay = new Map<string, number>();
  for (const e of events as any[]) {
    const day = new Date(e.createdAt).toISOString().slice(0, 10);
    byDay.set(day, (byDay.get(day) || 0) + 1);
  }

  const days: { date: string; pageviews: number }[] = [];
  for (let t = start.getTime(); t < endAt.getTime(); t += 86400_000) {
    const day = new Date(t).toISOString().slice(0, 10);
    days.push({ date: day, pageviews: byDay.get(day) || 0 });
  }
  return days;
}

export async function computeWidgetValue(widget: DashboardWidget): Promise<any> {
  const days = Math.min(365, Math.max(1, Number(widget.days) || 30));
  const endAt = new Date();
  const startAt = new Date(endAt.getTime() - days * 86400_000);
  const { websiteId } = widget;

  switch (widget.type) {
    case 'visitors': {
      const s = await getPeriodStats(websiteId, startAt, endAt);
      return { value: s.visitors, days };
    }
    case 'views': {
      const s = await getPeriodStats(websiteId, startAt, endAt);
      return { value: s.pageviews, days };
    }
    case 'bounce': {
      const s = await getPeriodStats(websiteId, startAt, endAt);
      return { value: s.bounceRate, unit: '%', days };
    }
    case 'trend':
      return { days, series: await dailyTrend(websiteId, startAt, endAt) };
    case 'top-pages':
      return { rows: await getTopGrouped(websiteId, startAt, endAt, 'urlPath', 5) };
    case 'top-referrers':
      return { rows: await getTopGrouped(websiteId, startAt, endAt, 'referrerDomain', 5) };
    case 'top-countries':
      return { rows: await getTopCountries(websiteId, startAt, endAt, 5) };
    case 'devices': {
      const counts = await getSessionDimensionCounts(websiteId, startAt, endAt, 'device');
      return { rows: [...counts.entries()].map(([name, count]) => ({ name, count })) };
    }
    case 'revenue': {
      const report = await getRevenueReport(websiteId, startAt, endAt);
      return { value: report.total, currency: report.currency, count: report.eventCount, days };
    }
    case 'online': {
      const db = pulseDb();
      const since = new Date(Date.now() - ONLINE_WINDOW_MS);
      const events = await db.websiteEvent.findMany({
        where: { websiteId, createdAt: { gte: since } },
        select: { sessionId: true },
        take: 10000,
      });
      return { value: new Set((events as any[]).map(e => e.sessionId)).size, windowMinutes: 5 };
    }
    default:
      return { error: `Unknown widget type: ${widget.type}` };
  }
}

export async function computeDashboardData(layout: DashboardWidget[]) {
  const values: Record<string, any> = {};
  for (const widget of layout || []) {
    try {
      values[widget.id] = await computeWidgetValue(widget);
    } catch (e: any) {
      values[widget.id] = { error: String(e?.message || e) };
    }
  }
  return values;
}
