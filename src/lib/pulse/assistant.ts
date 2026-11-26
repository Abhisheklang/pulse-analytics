import { getPeriodStats, MAX_PERIOD_EVENTS, pulseDb } from './stats';

// ---- Ask Pulse: plain-English analytics questions -> SAFE query plans ----
//
// Safety model: a question is never turned into SQL. It is turned into a
// QueryPlan whose every field comes from a fixed allow-list (intent, metric,
// dimension, range). Plans — whether produced by the built-in parser or by an
// LLM — must pass validatePlan() before anything runs, and execution only
// ever calls the existing parameterized Prisma helpers in ./stats with the
// allow-listed field names. Explanations are built from the executed result
// rows only, so every number in an answer comes from the site's real data.

export const ASK_INTENTS = ['summary', 'top', 'trend', 'compare'] as const;
export const ASK_METRICS = ['pageviews', 'visitors', 'visits', 'bounceRate'] as const;
export const ASK_DIMENSIONS = [
  'none',
  'page',
  'referrer',
  'country',
  'browser',
  'os',
  'device',
  'day',
] as const;
export const ASK_RANGES = [
  'today',
  'yesterday',
  'specificDay',
  'lastNDays',
  'thisWeek',
  'lastWeek',
  'thisMonth',
  'lastMonth',
] as const;

export type AskIntent = (typeof ASK_INTENTS)[number];
export type AskMetric = (typeof ASK_METRICS)[number];
export type AskDimension = (typeof ASK_DIMENSIONS)[number];
export type AskRange = (typeof ASK_RANGES)[number];

export interface QueryPlan {
  intent: AskIntent;
  metric: AskMetric;
  dimension: AskDimension;
  range: AskRange;
  /** Only for range = 'lastNDays' (1..90). */
  days?: number;
  /** Only for range = 'specificDay': day of week 0 (Sun) .. 6 (Sat). */
  weekday?: number;
  /** Sanitized referrer filter, e.g. 'google'. Never raw user text. */
  filterValue?: string;
  limit: number;
}

export interface ResolvedRange {
  startAt: Date;
  endAt: Date;
  prevStartAt: Date;
  prevEndAt: Date;
  label: string;
}

export interface AskRow {
  name: string;
  value: number;
  previous?: number;
}

export interface AskResult {
  rows: AskRow[];
  total: number;
  previousTotal?: number;
}

export type ParseOutcome = { plan: QueryPlan } | { refusal: string };

export const ASK_EXAMPLES = [
  'Which pages got the most views this month?',
  'How many visitors came from Google this week?',
  'Why did traffic drop last Tuesday?',
  'What are my top referrers in the last 30 days?',
  'How many pageviews did I get yesterday?',
  'Which countries send me the most visitors?',
  'Show me pageviews per day this week',
  'What is my bounce rate this month?',
];

export const ASK_CAPABILITIES = [
  'Totals: pageviews, visitors, visits and bounce rate for a period',
  'Top pages, referrers, countries, browsers, operating systems and devices',
  'Traffic per day (trend) for a period',
  'Period-over-period change, including why traffic rose or fell (with the biggest page and referrer movers)',
  'Counts filtered to one referrer, e.g. "visitors from Google"',
  'Periods: today, yesterday, a named weekday ("last Tuesday"), the last N days, this/last week, this/last month',
];

const DAY_MS = 86400_000;

// COR-1: all Ask Pulse day boundaries are UTC. Buckets are keyed by UTC
// date (toISOString) and events are bucketed by their UTC date, so the
// range itself must start at a UTC midnight; a server-local midnight
// shifted every bucket key and silently dropped boundary-day events.
function startOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function fmtDay(d: Date): string {
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** Pure: resolve a plan's range to concrete [start, end) bounds plus the
 *  equally-sized previous period used for comparisons. */
export function resolveRange(plan: Pick<QueryPlan, 'range' | 'days' | 'weekday'>, now: Date): ResolvedRange {
  const today = startOfDay(now);
  let start: Date;
  let end: Date;
  let label: string;

  switch (plan.range) {
    case 'today': {
      start = today;
      end = new Date(today.getTime() + DAY_MS);
      label = `today (${fmtDay(today)})`;
      break;
    }
    case 'yesterday': {
      start = new Date(today.getTime() - DAY_MS);
      end = today;
      label = `yesterday (${fmtDay(start)})`;
      break;
    }
    case 'specificDay': {
      const target = plan.weekday ?? now.getUTCDay();
      let daysAgo = (now.getUTCDay() - target + 7) % 7;
      if (daysAgo === 0) daysAgo = 7;
      start = new Date(today.getTime() - daysAgo * DAY_MS);
      end = new Date(start.getTime() + DAY_MS);
      const name = start.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
      label = `${name} ${fmtDay(start)}`;
      break;
    }
    case 'thisWeek': {
      const dow = (today.getUTCDay() + 6) % 7; // Monday = 0
      start = new Date(today.getTime() - dow * DAY_MS);
      end = new Date(today.getTime() + DAY_MS);
      label = `this week (from ${fmtDay(start)})`;
      break;
    }
    case 'lastWeek': {
      const dow = (today.getUTCDay() + 6) % 7;
      end = new Date(today.getTime() - dow * DAY_MS);
      start = new Date(end.getTime() - 7 * DAY_MS);
      label = `last week (${fmtDay(start)} – ${fmtDay(new Date(end.getTime() - DAY_MS))})`;
      break;
    }
    case 'thisMonth': {
      start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
      end = new Date(today.getTime() + DAY_MS);
      label = `this month (from ${fmtDay(start)})`;
      break;
    }
    case 'lastMonth': {
      start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
      end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
      label = `last month (${fmtDay(start)} – ${fmtDay(new Date(end.getTime() - DAY_MS))})`;
      break;
    }
    default: {
      const days = Math.min(90, Math.max(1, plan.days || 7));
      start = new Date(today.getTime() - (days - 1) * DAY_MS);
      end = new Date(today.getTime() + DAY_MS);
      label = `the last ${days} days (from ${fmtDay(start)})`;
    }
  }

  const span = end.getTime() - start.getTime();
  return {
    startAt: start,
    endAt: end,
    prevStartAt: new Date(start.getTime() - span),
    prevEndAt: start,
    label,
  };
}

const WEEKDAYS: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

// Topics the assistant deliberately cannot answer from analytics events.
const UNSUPPORTED: { pattern: RegExp; reason: string }[] = [
  {
    pattern: /\b(forecast|predict|prediction|future|will i get|next month'?s traffic will)\b/,
    reason: 'I can only report on traffic that has already happened — I cannot forecast or predict future traffic.',
  },
  {
    pattern: /\b(revenue|sales|money|profit|income|orders|checkout)\b/,
    reason: 'That question is about revenue, which Ask Pulse does not cover. Use the Revenue tracking page for money questions.',
  },
  {
    pattern: /\b(who is|visitor'?s name|email address|phone number|identify the|ip address)\b/,
    reason: 'Pulse is privacy-first: individual visitors cannot be identified, so I cannot answer questions about specific people.',
  },
  {
    pattern: /\b(delete|remove|erase|edit|change my|update my)\b/,
    reason: 'Ask Pulse is read-only — it cannot change or delete any data.',
  },
  {
    pattern: /\b(weather|news|stock price|joke|recipe)\b/,
    reason: 'That is outside your analytics data, so I cannot answer it here.',
  },
];

/** FIN-7: the built-in parser's topic refusals apply to EVERY path,
 *  including the LLM path. Previously an LLM-produced plan only had to
 *  pass the field allow-list, so a refused topic (revenue, deletion,
 *  visitor identity) that mapped onto an allow-listed plan shape was
 *  executed anyway. Returns the refusal reason, or null. */
export function unsupportedTopic(question: string): string | null {
  const q = ` ${question.toLowerCase().replace(/\s+/g, ' ').trim()} `;
  for (const { pattern, reason } of UNSUPPORTED) {
    if (pattern.test(q)) return reason;
  }
  return null;
}

/** Sanitize a referrer filter candidate to a safe token, or undefined. */
export function sanitizeFilter(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  const clean = raw
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, '')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 50);
  return clean.length >= 2 ? clean : undefined;
}

function parseRange(q: string): Pick<QueryPlan, 'range' | 'days' | 'weekday'> {
  const weekdayMatch = q.match(
    /\b(?:last\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/,
  );
  if (weekdayMatch) return { range: 'specificDay', weekday: WEEKDAYS[weekdayMatch[1]] };
  if (/\byesterday\b/.test(q)) return { range: 'yesterday' };
  if (/\btoday\b/.test(q)) return { range: 'today' };
  if (/\bthis week\b/.test(q)) return { range: 'thisWeek' };
  if (/\blast week\b/.test(q)) return { range: 'lastWeek' };
  if (/\bthis month\b/.test(q)) return { range: 'thisMonth' };
  if (/\blast month\b/.test(q)) return { range: 'lastMonth' };
  const nDays = q.match(/\blast\s+(\d{1,3})\s+days?\b/);
  if (nDays) return { range: 'lastNDays', days: Math.min(90, Math.max(1, Number(nDays[1]))) };
  if (/\bthis year|last year|all time\b/.test(q)) return { range: 'lastNDays', days: 90 };
  return { range: 'lastNDays', days: 7 };
}

/** Deterministic built-in parser: question -> allow-listed plan, or refusal. */
export function parseQuestion(question: string, _now: Date = new Date()): ParseOutcome {
  const q = ` ${question.toLowerCase().replace(/\s+/g, ' ').trim()} `;

  for (const { pattern, reason } of UNSUPPORTED) {
    if (pattern.test(q)) return { refusal: reason };
  }

  // Referrer filter: "from google", "via bing", "referred by duckduckgo.com"
  let filterValue: string | undefined;
  const fromMatch = q.match(/\b(?:from|via|referred by)\s+([a-z0-9.-]+)\b/);
  if (fromMatch && !/^(the|a|an|direct|my|this|last)$/.test(fromMatch[1])) {
    filterValue = sanitizeFilter(fromMatch[1].replace(/\.(com|net|org|io)$/, ''));
  }

  // Metric
  let metric: AskMetric = 'pageviews';
  if (/\bbounce\b/.test(q)) metric = 'bounceRate';
  else if (/\b(visitors?|uniques?|people|users?)\b/.test(q)) metric = 'visitors';
  else if (/\b(visits?|sessions?)\b/.test(q)) metric = 'visits';

  // Dimension
  let dimension: AskDimension = 'none';
  if (/\b(per day|by day|each day|daily|trend|over time|day by day)\b/.test(q)) dimension = 'day';
  else if (/\b(pages?|urls?|articles?|posts?|landing)\b/.test(q)) dimension = 'page';
  else if (/\b(countries|country|locations?|geograph)/.test(q)) dimension = 'country';
  else if (/\bbrowsers?\b/.test(q)) dimension = 'browser';
  else if (/\b(operating systems?|os)\b/.test(q)) dimension = 'os';
  else if (/\b(devices?|mobile|desktop|tablet)\b/.test(q)) dimension = 'device';
  else if (/\b(referrers?|referrals?|sources?)\b/.test(q) && !filterValue) dimension = 'referrer';

  const rangePart = parseRange(q);

  // Intent
  const asksWhy = /\bwhy\b/.test(q);
  const asksChange =
    /\b(drop|dropped|fall|fell|decline|decrease|down|rise|rose|increase|grew|growth|spike|change|changed|compare|versus|vs\.?)\b/.test(
      q,
    );
  const asksTop = /\b(top|most|biggest|highest|popular|best|which|what are)\b/.test(q);

  if (asksWhy || (asksChange && dimension === 'none')) {
    return {
      plan: { intent: 'compare', metric, dimension: 'none', ...rangePart, filterValue, limit: 10 },
    };
  }
  if (dimension === 'day') {
    return { plan: { intent: 'trend', metric, dimension, ...rangePart, filterValue, limit: 31 } };
  }
  if (dimension !== 'none' && (asksTop || /\bwhich|what|show|list\b/.test(q))) {
    return { plan: { intent: 'top', metric, dimension, ...rangePart, filterValue, limit: 10 } };
  }
  if (/\b(how many|how much|total|number of|count)\b/.test(q) || metric !== 'pageviews' || filterValue) {
    return { plan: { intent: 'summary', metric, dimension: 'none', ...rangePart, filterValue, limit: 10 } };
  }
  if (dimension !== 'none') {
    return { plan: { intent: 'top', metric, dimension, ...rangePart, filterValue, limit: 10 } };
  }
  if (/\b(traffic|pageviews?|views?|visitors?|visits?|sessions?|bounce)\b/.test(q)) {
    return { plan: { intent: 'summary', metric, dimension: 'none', ...rangePart, filterValue, limit: 10 } };
  }

  return {
    refusal:
      'I could not map that question to anything I can measure from your analytics data. Try one of the supported question types below.',
  };
}

/** Strict allow-list validation for ANY plan (built-in or LLM-produced).
 *  Returns a clean plan or null. This is the gate that makes LLM output safe:
 *  unknown intents/metrics/dimensions/ranges are rejected outright. */
export function validatePlan(raw: any): QueryPlan | null {
  if (!raw || typeof raw !== 'object') return null;
  if (!ASK_INTENTS.includes(raw.intent)) return null;
  if (!ASK_METRICS.includes(raw.metric)) return null;
  if (!ASK_DIMENSIONS.includes(raw.dimension)) return null;
  if (!ASK_RANGES.includes(raw.range)) return null;

  const plan: QueryPlan = {
    intent: raw.intent,
    metric: raw.metric,
    dimension: raw.dimension,
    range: raw.range,
    limit: Math.min(20, Math.max(1, Number(raw.limit) || 10)),
  };
  if (plan.range === 'lastNDays') {
    plan.days = Math.min(90, Math.max(1, Number(raw.days) || 7));
  }
  if (plan.range === 'specificDay') {
    const wd = Number(raw.weekday);
    if (!Number.isInteger(wd) || wd < 0 || wd > 6) return null;
    plan.weekday = wd;
  }
  const filter = sanitizeFilter(typeof raw.filterValue === 'string' ? raw.filterValue : undefined);
  if (filter) plan.filterValue = filter;
  if (plan.intent === 'trend') plan.dimension = 'day';
  if (plan.intent === 'compare') plan.dimension = 'none';
  return plan;
}

export function isLLMConfigured(): boolean {
  return Boolean(openAIKey());
}

function openAIKey(): string | undefined {
  return process.env.OPENAI_API_KEY;
}

/** LLM parsing: the model may ONLY return a plan in the allow-listed format.
 *  Its output is passed through validatePlan(); anything invalid, any network
 *  error, or any timeout returns null so the caller falls back to the
 *  built-in parser. The model never sees or writes SQL. */
export async function parseQuestionWithLLM(question: string): Promise<QueryPlan | null> {
  if (!openAIKey()) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${openAIKey()}` },
      signal: controller.signal,
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'You convert an analytics question into a JSON query plan. Respond with ONLY a JSON object with keys: ' +
              `intent (one of ${ASK_INTENTS.join(', ')}), metric (one of ${ASK_METRICS.join(', ')}), ` +
              `dimension (one of ${ASK_DIMENSIONS.join(', ')}), range (one of ${ASK_RANGES.join(', ')}), ` +
              'optional days (1-90, only for lastNDays), optional weekday (0=Sunday..6=Saturday, only for specificDay), ' +
              'optional filterValue (a single referrer token like "google"), limit (1-20). ' +
              'Use intent "compare" for why/change questions, "trend" for per-day questions, "top" for ranked lists, "summary" for totals. ' +
              'If the question cannot be answered with these options, respond with {"refusal": true}. Never output SQL.',
          },
          { role: 'user', content: question.slice(0, 300) },
        ],
      }),
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return null;
    const parsed = JSON.parse(content);
    if (parsed?.refusal) return null;
    return validatePlan(parsed);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function metricOf(stats: { pageviews: number; visitors: number; visits: number; bounceRate: number }, metric: AskMetric): number {
  return stats[metric];
}

async function groupedCounts(
  websiteId: string,
  startAt: Date,
  endAt: Date,
  field: 'urlPath' | 'referrerDomain',
): Promise<Map<string, number>> {
  const rows = await pulseDb().websiteEvent.groupBy({
    by: [field],
    where: { websiteId, eventType: 1, createdAt: { gte: startAt, lt: endAt } },
    _count: { _all: true },
    orderBy: { _count: { [field]: 'desc' } },
    take: 50,
  });
  const map = new Map<string, number>();
  for (const r of rows as any[]) map.set(r[field] || '(direct)', r._count._all);
  return map;
}

/** COR-2: rank groups by the REQUESTED metric. The previous top branch
 *  always counted pageview events (or sessions for session dimensions)
 *  regardless of the metric in the plan, then labelled the numbers with
 *  the requested metric. Groups are aggregated in memory from the
 *  period's pageview events, capped like the other Pulse aggregations. */
async function topByMetric(
  websiteId: string,
  startAt: Date,
  endAt: Date,
  dimension: AskDimension,
  metric: AskMetric,
  limit: number,
): Promise<AskRow[]> {
  const db = pulseDb();

  let sessionNames: Map<string, string> | null = null;
  if (
    dimension === 'country' ||
    dimension === 'browser' ||
    dimension === 'os' ||
    dimension === 'device'
  ) {
    const sessions = await db.session.findMany({
      where: { websiteId, createdAt: { gte: startAt, lt: endAt } },
      select: { id: true, [dimension]: true },
      take: MAX_PERIOD_EVENTS,
    });
    sessionNames = new Map(
      (sessions as any[]).map(s => [s.id, s[dimension] || 'Unknown']),
    );
  }

  const events = await db.websiteEvent.findMany({
    where: { websiteId, eventType: 1, createdAt: { gte: startAt, lt: endAt } },
    select: { sessionId: true, visitId: true, urlPath: true, referrerDomain: true },
    take: MAX_PERIOD_EVENTS,
  });

  interface Group {
    pageviews: number;
    sessions: Set<string>;
    visits: Set<string>;
    perSession: Map<string, number>;
  }
  const groups = new Map<string, Group>();
  for (const e of events as any[]) {
    const name =
      dimension === 'page'
        ? e.urlPath || '(direct)'
        : dimension === 'referrer'
          ? e.referrerDomain || '(direct)'
          : sessionNames?.get(e.sessionId) || 'Unknown';
    let g = groups.get(name);
    if (!g) {
      g = { pageviews: 0, sessions: new Set(), visits: new Set(), perSession: new Map() };
      groups.set(name, g);
    }
    g.pageviews++;
    g.sessions.add(e.sessionId);
    g.visits.add(e.visitId);
    g.perSession.set(e.sessionId, (g.perSession.get(e.sessionId) || 0) + 1);
  }

  const value = (g: Group): number => {
    switch (metric) {
      case 'visitors':
        return g.sessions.size;
      case 'visits':
        return g.visits.size;
      case 'bounceRate': {
        if (!g.sessions.size) return 0;
        let single = 0;
        for (const count of g.perSession.values()) if (count === 1) single++;
        return Math.round((single / g.sessions.size) * 100);
      }
      default:
        return g.pageviews;
    }
  };

  return [...groups.entries()]
    .map(([name, g]) => ({ name, value: value(g) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

/** Execute a validated plan against the site's real data. Only allow-listed
 *  fields and the existing parameterized Prisma helpers are used. */
export async function executePlan(websiteId: string, plan: QueryPlan, now: Date = new Date()): Promise<AskResult> {
  const range = resolveRange(plan, now);
  const { startAt, endAt, prevStartAt, prevEndAt } = range;

  if (plan.intent === 'trend') {
    const events = await pulseDb().websiteEvent.findMany({
      where: { websiteId, eventType: 1, createdAt: { gte: startAt, lt: endAt } },
      select: { createdAt: true, sessionId: true, visitId: true },
      take: MAX_PERIOD_EVENTS,
    });
    // COR-2: every metric is computed per day, not just visitors vs
    // pageviews. Visits need the visit id and bounce rate needs the
    // per-session pageview count within the day.
    interface DayBucket {
      pageviews: number;
      sessions: Set<string>;
      visits: Set<string>;
      perSession: Map<string, number>;
    }
    const newBucket = (): DayBucket => ({
      pageviews: 0,
      sessions: new Set(),
      visits: new Set(),
      perSession: new Map(),
    });
    const byDay = new Map<string, DayBucket>();
    for (let t = startAt.getTime(); t < endAt.getTime(); t += DAY_MS) {
      byDay.set(new Date(t).toISOString().slice(0, 10), newBucket());
    }
    for (const e of events as any[]) {
      const key = new Date(e.createdAt).toISOString().slice(0, 10);
      const bucket = byDay.get(key);
      if (bucket) {
        bucket.pageviews++;
        bucket.sessions.add(e.sessionId);
        bucket.visits.add(e.visitId);
        bucket.perSession.set(e.sessionId, (bucket.perSession.get(e.sessionId) || 0) + 1);
      }
    }
    const dayValue = (b: DayBucket): number => {
      switch (plan.metric) {
        case 'visitors':
          return b.sessions.size;
        case 'visits':
          return b.visits.size;
        case 'bounceRate': {
          if (!b.sessions.size) return 0;
          let single = 0;
          for (const count of b.perSession.values()) if (count === 1) single++;
          return Math.round((single / b.sessions.size) * 100);
        }
        default:
          return b.pageviews;
      }
    };
    const rows: AskRow[] = [...byDay.entries()].map(([day, v]) => ({
      name: day,
      value: dayValue(v),
    }));
    // A bounce-rate trend has no meaningful summed total; report the
    // period bounce rate instead of adding daily percentages.
    const total =
      plan.metric === 'bounceRate'
        ? (await getPeriodStats(websiteId, startAt, endAt)).bounceRate
        : rows.reduce((a, r) => a + r.value, 0);
    return { rows, total };
  }

  if (plan.intent === 'top') {
    const rows = await topByMetric(
      websiteId,
      startAt,
      endAt,
      plan.dimension,
      plan.metric,
      plan.limit,
    );
    // COR-2: the total is the site-wide total of the requested metric
    // for the period, not the sum of the top-N rows, so the share in
    // the explanation is a share of the whole period.
    const stats = await getPeriodStats(websiteId, startAt, endAt);
    return { rows, total: metricOf(stats, plan.metric) };
  }

  if (plan.intent === 'compare') {
    const [cur, prev] = await Promise.all([
      getPeriodStats(websiteId, startAt, endAt),
      getPeriodStats(websiteId, prevStartAt, prevEndAt),
    ]);
    const rows: AskRow[] = [
      { name: 'Pageviews', value: cur.pageviews, previous: prev.pageviews },
      { name: 'Visitors', value: cur.visitors, previous: prev.visitors },
      { name: 'Visits', value: cur.visits, previous: prev.visits },
      { name: 'Bounce rate %', value: cur.bounceRate, previous: prev.bounceRate },
    ];
    // Biggest movers by page and referrer explain the change.
    const [curPages, prevPages, curRefs, prevRefs] = await Promise.all([
      groupedCounts(websiteId, startAt, endAt, 'urlPath'),
      groupedCounts(websiteId, prevStartAt, prevEndAt, 'urlPath'),
      groupedCounts(websiteId, startAt, endAt, 'referrerDomain'),
      groupedCounts(websiteId, prevStartAt, prevEndAt, 'referrerDomain'),
    ]);
    const movers = (curMap: Map<string, number>, prevMap: Map<string, number>, kind: string) => {
      const out: AskRow[] = [];
      for (const name of new Set([...curMap.keys(), ...prevMap.keys()])) {
        const c = curMap.get(name) || 0;
        const p = prevMap.get(name) || 0;
        if (c !== p) out.push({ name: `${kind}: ${name}`, value: c, previous: p });
      }
      return out.sort((a, b) => Math.abs(b.value - (b.previous || 0)) - Math.abs(a.value - (a.previous || 0)));
    };
    rows.push(...movers(curPages, prevPages, 'Page').slice(0, 3));
    rows.push(...movers(curRefs, prevRefs, 'Referrer').slice(0, 3));
    return { rows, total: metricOf(cur, plan.metric), previousTotal: metricOf(prev, plan.metric) };
  }

  // summary
  if (plan.filterValue) {
    const count = await pulseDb().websiteEvent.count({
      where: {
        websiteId,
        eventType: 1,
        createdAt: { gte: startAt, lt: endAt },
        referrerDomain: { contains: plan.filterValue, mode: 'insensitive' },
      },
    });
    const stats = await getPeriodStats(websiteId, startAt, endAt);
    return {
      rows: [
        { name: `Pageviews from ${plan.filterValue}`, value: count },
        { name: 'Pageviews (all sources)', value: stats.pageviews },
        { name: 'Visitors (all sources)', value: stats.visitors },
      ],
      total: count,
    };
  }

  const stats = await getPeriodStats(websiteId, startAt, endAt);
  return {
    rows: [
      { name: 'Pageviews', value: stats.pageviews },
      { name: 'Visitors', value: stats.visitors },
      { name: 'Visits', value: stats.visits },
      { name: 'Bounce rate %', value: stats.bounceRate },
    ],
    total: metricOf(stats, plan.metric),
  };
}

const METRIC_LABEL: Record<AskMetric, string> = {
  pageviews: 'pageviews',
  visitors: 'visitors',
  visits: 'visits',
  bounceRate: 'bounce rate',
};

/** Pure: build the explanation strictly from the executed result numbers. */
export function explainResult(plan: QueryPlan, result: AskResult, rangeLabel: string): string {
  const metric = METRIC_LABEL[plan.metric];

  if (plan.intent === 'trend') {
    if (result.rows.length === 0) return `No data was recorded for ${rangeLabel}.`;
    const peak = result.rows.reduce((a, r) => (r.value > a.value ? r : a), result.rows[0]);
    const low = result.rows.reduce((a, r) => (r.value < a.value ? r : a), result.rows[0]);
    return `Over ${rangeLabel} you recorded ${result.total} ${metric} in total. The busiest day was ${peak.name} with ${peak.value}, and the quietest was ${low.name} with ${low.value}. The table below shows every day in the period.`;
  }

  if (plan.intent === 'top') {
    if (result.rows.length === 0) {
      return `No ${plan.dimension} data was recorded for ${rangeLabel} — there is nothing to rank yet.`;
    }
    const top = result.rows[0];
    if (plan.metric === 'bounceRate') {
      return `For ${rangeLabel}, the highest bounce rate is ${top.name} at ${top.value}%. The table below shows the ranked rows.`;
    }
    const share = result.total ? Math.round((top.value / result.total) * 100) : 0;
    return `For ${rangeLabel}, the top ${plan.dimension} is ${top.name} with ${top.value} ${metric} — ${share}% of the ${result.total} ${metric} recorded in the period.`;
  }

  if (plan.intent === 'compare') {
    const cur = result.total;
    const prev = result.previousTotal || 0;
    if (prev === 0 && cur === 0) {
      return `No ${metric} were recorded in ${rangeLabel} or in the period before it, so there is no change to explain yet.`;
    }
    if (prev === 0) {
      return `In ${rangeLabel} you recorded ${cur} ${metric}, versus 0 in the previous period — all of this traffic is new relative to that baseline. The biggest movers are listed below.`;
    }
    const pct = Math.round(((cur - prev) / prev) * 100);
    const direction = pct > 0 ? `rose ${pct}%` : pct < 0 ? `fell ${Math.abs(pct)}%` : 'did not change';
    const movers = result.rows.filter(r => r.name.includes(':'));
    let driver = '';
    if (movers.length > 0) {
      const m = movers[0];
      const delta = m.value - (m.previous || 0);
      driver = ` The largest mover was ${m.name}, which ${delta >= 0 ? 'gained' : 'lost'} ${Math.abs(delta)} views (${m.previous || 0} → ${m.value}).`;
    }
    return `${metric[0].toUpperCase() + metric.slice(1)} ${direction} in ${rangeLabel}: ${prev} in the previous period versus ${cur} in this one.${driver} The full comparison is in the table below.`;
  }

  // summary
  if (plan.filterValue) {
    const all = result.rows.find(r => r.name === 'Pageviews (all sources)')?.value || 0;
    const share = all ? Math.round((result.total / all) * 100) : 0;
    return `In ${rangeLabel}, ${result.total} pageviews came from a referrer matching "${plan.filterValue}" — that is ${share}% of the ${all} pageviews from all sources in the same period.`;
  }
  const row = result.rows.find(r => r.name.toLowerCase().startsWith(metric.replace(' %', '')));
  const value = plan.metric === 'bounceRate' ? result.rows[3]?.value : (row?.value ?? result.total);
  return `For ${rangeLabel}: ${value}${plan.metric === 'bounceRate' ? '%' : ''} ${metric}. The table below shows pageviews, visitors, visits and bounce rate for the same period.`;
}

/** Human-readable view of the plan that ran — shown to the user. */
export function describePlan(plan: QueryPlan, rangeLabel: string) {
  return {
    intent: plan.intent,
    metric: plan.metric,
    dimension: plan.dimension,
    period: rangeLabel,
    ...(plan.filterValue ? { filter: `referrer contains "${plan.filterValue}"` } : {}),
    limit: plan.limit,
  };
}

export interface AskResponse {
  status: 'ok' | 'refused';
  mode: 'llm' | 'builtin';
  llmConfigured: boolean;
  question: string;
  plan?: ReturnType<typeof describePlan>;
  rows?: AskRow[];
  explanation: string;
  capabilities?: string[];
}

/** Orchestrate: parse (LLM if configured, else built-in) -> execute -> explain. */
export async function askPulse(websiteId: string, question: string, now: Date = new Date()): Promise<AskResponse> {
  const llmConfigured = isLLMConfigured();
  let mode: 'llm' | 'builtin' = 'builtin';
  let plan: QueryPlan | null = null;
  let refusal: string | null = null;

  // FIN-7: topic refusals run before any parser, LLM included.
  refusal = unsupportedTopic(question);

  if (!refusal && llmConfigured) {
    plan = await parseQuestionWithLLM(question);
    if (plan) mode = 'llm';
  }
  if (!refusal && !plan) {
    const outcome = parseQuestion(question, now);
    if ('refusal' in outcome) refusal = outcome.refusal;
    else plan = outcome.plan;
  }

  if (!plan) {
    return {
      status: 'refused',
      mode,
      llmConfigured,
      question,
      explanation:
        refusal || 'I cannot answer that from your data. Here is what I can answer:',
      capabilities: ASK_CAPABILITIES,
    };
  }

  const range = resolveRange(plan, now);
  const result = await executePlan(websiteId, plan, now);
  return {
    status: 'ok',
    mode,
    llmConfigured,
    question,
    plan: describePlan(plan, range.label),
    rows: result.rows,
    explanation: explainResult(plan, result, range.label),
  };
}
