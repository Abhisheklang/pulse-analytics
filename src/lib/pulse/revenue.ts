import { pulseDb } from './stats';

// Revenue is carried as event data on normal custom events: any event whose
// data includes a numeric "revenue" key (and optional "currency" string)
// counts towards revenue reporting.

export interface RevenueRow {
  websiteEventId: string;
  numberValue: any;
  websiteEvent: {
    urlPath: string | null;
    referrerDomain: string | null;
    sessionId: string;
    createdAt: Date | string;
  } | null;
}

// Pure aggregation (unit-tested): bucket revenue rows by currency (per-event
// override wins, else the site default), summing totals, counting events and
// distinct sessions, and breaking down by day / page / referrer.
export function aggregateRevenueRows(
  revenueRows: RevenueRow[],
  currencyByEvent: Map<string, string>,
  defaultCurrency: string,
) {
  interface Bucket {
    total: number;
    count: number;
    sessions: Set<string>;
    byDay: Map<string, { total: number; count: number }>;
    byPage: Map<string, { total: number; count: number }>;
    byReferrer: Map<string, { total: number; count: number }>;
  }

  const buckets = new Map<string, Bucket>();
  const bucketFor = (currency: string): Bucket => {
    if (!buckets.has(currency)) {
      buckets.set(currency, {
        total: 0,
        count: 0,
        sessions: new Set(),
        byDay: new Map(),
        byPage: new Map(),
        byReferrer: new Map(),
      });
    }
    return buckets.get(currency)!;
  };

  const addTo = (map: Map<string, { total: number; count: number }>, key: string, v: number) => {
    const cur = map.get(key) || { total: 0, count: 0 };
    cur.total += v;
    cur.count += 1;
    map.set(key, cur);
  };

  for (const row of revenueRows as any[]) {
    const value = Number(row.numberValue);
    if (!isFinite(value)) continue;
    const ev = row.websiteEvent;
    if (!ev) continue;

    const currency = currencyByEvent.get(row.websiteEventId) || defaultCurrency;
    const b = bucketFor(currency);
    b.total += value;
    b.count += 1;
    b.sessions.add(ev.sessionId);

    const day = new Date(ev.createdAt).toISOString().slice(0, 10);
    addTo(b.byDay, day, value);
    addTo(b.byPage, ev.urlPath || '/', value);
    addTo(b.byReferrer, ev.referrerDomain || '(direct)', value);
  }

  const round2 = (n: number) => Math.round(n * 100) / 100;
  const sortedList = (map: Map<string, { total: number; count: number }>, byDate = false) =>
    [...map.entries()]
      .map(([name, v]) => ({ name, total: round2(v.total), count: v.count }))
      .sort((a, b) => (byDate ? (a.name < b.name ? -1 : 1) : b.total - a.total));

  const shape = (currency: string, b: Bucket) => ({
    currency,
    total: round2(b.total),
    eventCount: b.count,
    visitors: b.sessions.size,
    avgPerVisitor: b.sessions.size ? round2(b.total / b.sessions.size) : 0,
    byDay: sortedList(b.byDay, true),
    byPage: sortedList(b.byPage).slice(0, 10),
    byReferrer: sortedList(b.byReferrer).slice(0, 10),
  });

  const primary = buckets.get(defaultCurrency);
  const others = [...buckets.entries()]
    .filter(([c]) => c !== defaultCurrency)
    .map(([currency, b]) => ({ currency, total: round2(b.total), eventCount: b.count }));

  return {
    currency: defaultCurrency,
    ...(primary
      ? shape(defaultCurrency, primary)
      : {
          total: 0,
          eventCount: 0,
          visitors: 0,
          avgPerVisitor: 0,
          byDay: [],
          byPage: [],
          byReferrer: [],
        }),
    otherCurrencies: others,
  };
}

export async function getRevenueReport(websiteId: string, startAt: Date, endAt: Date) {
  const db = pulseDb();

  const [setting, revenueRows] = await Promise.all([
    db.pulseSiteSetting.findUnique({ where: { websiteId } }),
    db.eventData.findMany({
      where: {
        websiteId,
        dataKey: 'revenue',
        numberValue: { not: null },
        createdAt: { gte: startAt, lt: endAt },
      },
      select: {
        websiteEventId: true,
        numberValue: true,
        websiteEvent: {
          select: { urlPath: true, referrerDomain: true, sessionId: true, createdAt: true },
        },
      },
      take: 100000,
    }),
  ]);

  const defaultCurrency = setting?.revenueCurrency || 'USD';

  // Per-event currency overrides (event data key "currency").
  const eventIds = revenueRows.map((r: any) => r.websiteEventId);
  const currencyRows = eventIds.length
    ? await db.eventData.findMany({
        where: { websiteId, dataKey: 'currency', websiteEventId: { in: eventIds } },
        select: { websiteEventId: true, stringValue: true },
      })
    : [];
  const currencyByEvent = new Map<string, string>(
    currencyRows.map((r: any) => [r.websiteEventId, (r.stringValue || '').toUpperCase()]),
  );

  return aggregateRevenueRows(revenueRows as any, currencyByEvent, defaultCurrency);
}
