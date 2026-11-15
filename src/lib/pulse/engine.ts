import { uuid } from '@/lib/crypto';
import { channelOf, deliverEmail, deliverToChannel, hasTarget } from './deliver';
import { getPeriodStats, getTopCountries, getTopGrouped, pulseDb } from './stats';

const db = () => pulseDb();

// ---------- Alerts ----------

export async function evaluateAlertRule(rule: any) {
  const now = new Date();
  const windowMs = rule.windowHours * 3600_000;
  const currentStart = new Date(now.getTime() - windowMs);
  const baselineStart = new Date(now.getTime() - windowMs * 2);

  const current = await getPeriodStats(rule.websiteId, currentStart, now);
  const baseline = await getPeriodStats(rule.websiteId, baselineStart, currentStart);

  const metric = rule.metric === 'visitors' ? 'visitors' : 'pageviews';
  const cur = current[metric];
  const base = baseline[metric];

  let fired = false;
  let message = '';

  switch (rule.condition) {
    case 'spike': {
      const pct = base > 0 ? ((cur - base) / base) * 100 : cur > 0 ? 100 : 0;
      fired = pct >= rule.threshold;
      message = `${metric} changed ${pct.toFixed(1)}% vs previous ${rule.windowHours}h (${base} -> ${cur}). Spike threshold ${rule.threshold}%.`;
      break;
    }
    case 'drop': {
      const pct = base > 0 ? ((base - cur) / base) * 100 : 0;
      fired = pct >= rule.threshold;
      message = `${metric} dropped ${pct.toFixed(1)}% vs previous ${rule.windowHours}h (${base} -> ${cur}). Drop threshold ${rule.threshold}%.`;
      break;
    }
    case 'above':
      fired = cur > rule.threshold;
      message = `${metric} is ${cur} in the last ${rule.windowHours}h (above threshold ${rule.threshold}).`;
      break;
    case 'below':
      fired = cur < rule.threshold;
      message = `${metric} is ${cur} in the last ${rule.windowHours}h (below threshold ${rule.threshold}).`;
      break;
    case 'nodata':
      fired = cur === 0;
      message = `No ${metric} recorded in the last ${rule.windowHours}h.`;
      break;
    default:
      message = `Unknown condition ${rule.condition}.`;
  }

  let delivered = false;
  let deliveryStatus: number | undefined;
  const channel = channelOf(rule);

  if (fired) {
    const alertMessage = {
      title: `Pulse alert: ${rule.name}`,
      text: message,
      extra: {
        source: 'pulse-alerts',
        rule: rule.name,
        websiteId: rule.websiteId,
        metric,
        condition: rule.condition,
        currentValue: cur,
        baselineValue: base,
        message,
      },
      fields: [
        { label: 'Metric', value: metric },
        { label: 'Condition', value: rule.condition },
        { label: 'Current', value: String(cur) },
        { label: 'Baseline', value: String(base) },
      ],
    };
    const result = await deliverToChannel(rule, alertMessage);
    delivered = result.ok;
    deliveryStatus = result.status;

    // Rules can also carry an email recipient alongside their primary channel.
    if (rule.emailTo && channel !== 'email') {
      const emailResult = await deliverEmail(rule, alertMessage);
      delivered = delivered || emailResult.ok;
      if (deliveryStatus === undefined) deliveryStatus = emailResult.status;
    }

    await db().pulseAlertRule.update({
      where: { id: rule.id },
      data: { lastFiredAt: now },
    });
  }

  const log = await db().pulseAlertLog.create({
    data: {
      id: uuid(),
      ruleId: rule.id,
      websiteId: rule.websiteId,
      fired,
      message,
      currentValue: cur,
      baselineValue: base,
      delivered,
      channel,
      deliveryStatus,
    },
  });

  return log;
}

export async function evaluateAllAlerts(websiteId?: string) {
  const rules = await db().pulseAlertRule.findMany({
    where: { enabled: true, ...(websiteId ? { websiteId } : {}) },
  });

  const results = [];
  for (const rule of rules) {
    results.push(await evaluateAlertRule(rule));
  }
  return results;
}

// ---------- Scheduled reports ----------

export interface ReportSummary {
  websiteId: string;
  periodDays: number;
  current: Awaited<ReturnType<typeof getPeriodStats>>;
  previous: Awaited<ReturnType<typeof getPeriodStats>>;
  topPages: { name: string; count: number }[];
  topReferrers: { name: string; count: number }[];
  topCountries: { name: string; count: number }[];
  generatedAt: string;
}

export async function buildReportSummary(
  websiteId: string,
  frequency: string,
): Promise<ReportSummary> {
  const days = frequency === 'daily' ? 1 : 7;
  const now = new Date();
  const start = new Date(now.getTime() - days * 86400_000);
  const prevStart = new Date(now.getTime() - days * 2 * 86400_000);

  const [current, previous, topPages, topReferrers, topCountries] = await Promise.all([
    getPeriodStats(websiteId, start, now),
    getPeriodStats(websiteId, prevStart, start),
    getTopGrouped(websiteId, start, now, 'urlPath'),
    getTopGrouped(websiteId, start, now, 'referrerDomain'),
    getTopCountries(websiteId, start, now),
  ]);

  return {
    websiteId,
    periodDays: days,
    current,
    previous,
    topPages,
    topReferrers,
    topCountries,
    generatedAt: now.toISOString(),
  };
}

export function summaryToCsv(summary: ReportSummary): string {
  const lines = [
    'section,name,value',
    `totals,pageviews,${summary.current.pageviews}`,
    `totals,visitors,${summary.current.visitors}`,
    `totals,visits,${summary.current.visits}`,
    `totals,bounceRate,${summary.current.bounceRate}`,
    ...summary.topPages.map(p => `top_pages,${JSON.stringify(p.name)},${p.count}`),
    ...summary.topReferrers.map(p => `top_referrers,${JSON.stringify(p.name)},${p.count}`),
    ...summary.topCountries.map(p => `top_countries,${JSON.stringify(p.name)},${p.count}`),
  ];
  return lines.join('\n');
}

export function summaryToText(summary: ReportSummary): string {
  const { current: c, previous: p } = summary;
  const delta = (a: number, b: number) => (b > 0 ? `${(((a - b) / b) * 100).toFixed(1)}%` : 'n/a');
  return [
    `Pulse Analytics ${summary.periodDays}-day summary`,
    `Visitors: ${c.visitors} (was ${p.visitors}, ${delta(c.visitors, p.visitors)})`,
    `Views: ${c.pageviews} (was ${p.pageviews}, ${delta(c.pageviews, p.pageviews)})`,
    `Bounce rate: ${c.bounceRate}%`,
    `Top page: ${summary.topPages[0]?.name || '-'} (${summary.topPages[0]?.count || 0})`,
    `Top referrer: ${summary.topReferrers[0]?.name || '-'} (${summary.topReferrers[0]?.count || 0})`,
  ].join('\n');
}

export async function sendReportSchedule(schedule: any) {
  const summary = await buildReportSummary(schedule.websiteId, schedule.frequency);
  const csv = summaryToCsv(summary);
  const text = summaryToText(summary);

  let delivered = false;
  let deliveryStatus: number | undefined;
  let emailNote: string | undefined;
  const channel = channelOf(schedule);

  const reportMessage = {
    title: `Pulse report: ${schedule.name}`,
    text,
    extra: { source: 'pulse-reports', schedule: schedule.name, summary, csv },
    fields: [
      { label: 'Visitors', value: String(summary.current.visitors) },
      { label: 'Views', value: String(summary.current.pageviews) },
      { label: 'Bounce rate', value: `${summary.current.bounceRate}%` },
    ],
  };

  // Schedules store recipients in `email`; delivery targets call it emailTo.
  const target = { ...schedule, emailTo: (schedule as any).emailTo || schedule.email };

  if (hasTarget(target)) {
    const result = await deliverToChannel(target, reportMessage);
    delivered = result.ok;
    deliveryStatus = result.status;
  }

  // A schedule's email recipient list is delivered via SMTP (Admin → Settings
  // → Email). When the schedule's channel is email this is the primary
  // delivery (handled above); otherwise it is an additional copy.
  if (schedule.email && channel !== 'email') {
    const emailResult = await deliverEmail({ emailTo: schedule.email }, reportMessage);
    emailNote = emailResult.ok
      ? `Email sent to ${schedule.email} (SMTP ${emailResult.status || 250}).`
      : `Email to ${schedule.email} failed: ${emailResult.error || 'unknown error'}`;
    delivered = delivered || emailResult.ok;
    if (deliveryStatus === undefined) deliveryStatus = emailResult.status;
  } else if (schedule.email && channel === 'email') {
    emailNote = delivered
      ? `Email sent to ${schedule.email} (SMTP ${deliveryStatus || 250}).`
      : 'Email delivery failed; see server logs.';
  }

  const log = await db().pulseReportLog.create({
    data: {
      id: uuid(),
      scheduleId: schedule.id,
      websiteId: schedule.websiteId,
      summary: { ...summary, emailNote } as any,
      csv,
      delivered,
      channel,
      deliveryStatus,
    },
  });

  await db().pulseReportSchedule.update({
    where: { id: schedule.id },
    data: { lastSentAt: new Date() },
  });

  return log;
}

export async function sendDueReports() {
  const schedules = await db().pulseReportSchedule.findMany({ where: { enabled: true } });
  const results = [];

  for (const schedule of schedules) {
    const intervalMs = (schedule.frequency === 'daily' ? 1 : 7) * 86400_000;
    const last = schedule.lastSentAt ? new Date(schedule.lastSentAt).getTime() : 0;
    if (Date.now() - last >= intervalMs) {
      results.push(await sendReportSchedule(schedule));
    }
  }

  return results;
}
