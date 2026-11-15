import { pulseDb } from './stats';

// Web Vitals are collected by the optional /pulse-vitals.js add-on script as
// custom events named "pulse.webvital" with event data { metric, value, path }.

export const VITALS_EVENT_NAME = 'pulse.webvital';

export interface MetricSummary {
  avg: number;
  p75: number;
  count: number;
  rating: 'good' | 'needs-improvement' | 'poor';
}

// [good, poor] thresholds per metric (standard web-vitals guidance)
const THRESHOLDS: Record<string, [number, number]> = {
  lcp: [2500, 4000],
  inp: [200, 500],
  cls: [0.1, 0.25],
  fcp: [1800, 3000],
  ttfb: [800, 1800],
};

export const METRICS = Object.keys(THRESHOLDS);

function rate(metric: string, value: number): 'good' | 'needs-improvement' | 'poor' {
  const t = THRESHOLDS[metric];
  if (!t) return 'good';
  if (value <= t[0]) return 'good';
  if (value > t[1]) return 'poor';
  return 'needs-improvement';
}

function summarize(metric: string, values: number[]): MetricSummary {
  const sorted = [...values].sort((a, b) => a - b);
  const round = (n: number) => (metric === 'cls' ? Math.round(n * 1000) / 1000 : Math.round(n));
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const p75 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.75))];
  return { avg: round(avg), p75: round(p75), count: values.length, rating: rate(metric, p75) };
}

export async function getWebVitals(websiteId: string, startAt: Date, endAt: Date) {
  const db = pulseDb();

  const events = await db.websiteEvent.findMany({
    where: {
      websiteId,
      eventName: VITALS_EVENT_NAME,
      createdAt: { gte: startAt, lt: endAt },
    },
    select: {
      urlPath: true,
      eventData: { select: { dataKey: true, stringValue: true, numberValue: true } },
    },
    take: 100000,
  });

  const byPage = new Map<string, Map<string, number[]>>();
  const siteWide = new Map<string, number[]>();

  for (const event of events as any[]) {
    let metric: string | null = null;
    let value: number | null = null;
    let path: string | null = null;

    for (const d of event.eventData) {
      if (d.dataKey === 'metric') metric = d.stringValue;
      if (d.dataKey === 'value' && d.numberValue != null) value = Number(d.numberValue);
      if (d.dataKey === 'path') path = d.stringValue;
    }

    if (!metric || value == null || !THRESHOLDS[metric]) continue;
    const page = path || event.urlPath || '/';

    if (!byPage.has(page)) byPage.set(page, new Map());
    const pageMetrics = byPage.get(page)!;
    if (!pageMetrics.has(metric)) pageMetrics.set(metric, []);
    pageMetrics.get(metric)!.push(value);

    if (!siteWide.has(metric)) siteWide.set(metric, []);
    siteWide.get(metric)!.push(value);
  }

  const summarizeMap = (m: Map<string, number[]>) => {
    const out: Record<string, MetricSummary> = {};
    for (const metric of METRICS) {
      const values = m.get(metric);
      if (values?.length) out[metric] = summarize(metric, values);
    }
    return out;
  };

  const pages = [...byPage.entries()]
    .map(([path, metrics]) => ({ path, metrics: summarizeMap(metrics) }))
    .sort((a, b) => {
      const count = (p: any) =>
        Object.values<MetricSummary>(p.metrics).reduce((a, m) => a + m.count, 0);
      return count(b) - count(a);
    });

  return {
    eventCount: events.length,
    summary: summarizeMap(siteWide),
    pages,
    thresholds: Object.fromEntries(
      Object.entries(THRESHOLDS).map(([k, [good, poor]]) => [k, { good, poor }]),
    ),
  };
}
