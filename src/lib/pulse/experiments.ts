import { pulseDb } from './stats';

// A/B testing: the optional /pulse-ab.js add-on reports an
// "experiment.exposure" custom event with event data { experiment, variant }
// when a visitor is assigned, and conversions are the exposed sessions that
// later fire the experiment's conversion event in the same session.

export const EXPOSURE_EVENT_NAME = 'experiment.exposure';
export const MIN_EXPOSURES = 30;

export interface ExperimentVariant {
  key: string;
  name?: string;
  weight: number;
  control?: boolean;
}

// Standard normal CDF via the Abramowitz–Stegun erf approximation.
function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p =
    d *
    t *
    (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

export interface VariantResult {
  key: string;
  name: string;
  control: boolean;
  exposures: number;
  conversions: number;
  rate: number;
  upliftPct: number | null;
  zScore: number | null;
  pValue: number | null;
  significant: boolean | null;
}

export function twoProportionZTest(
  c1: number,
  n1: number,
  c2: number,
  n2: number,
): { z: number; p: number } | null {
  if (!n1 || !n2) return null;
  const p1 = c1 / n1;
  const p2 = c2 / n2;
  const pooled = (c1 + c2) / (n1 + n2);
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / n1 + 1 / n2));
  if (!se) return null;
  const z = (p2 - p1) / se;
  const p = 2 * (1 - normalCdf(Math.abs(z)));
  return { z, p };
}

export async function getExperimentResults(experiment: any, startAt?: Date, endAt?: Date) {
  const db = pulseDb();
  const variants: ExperimentVariant[] = Array.isArray(experiment.variants)
    ? experiment.variants
    : [];

  const range =
    startAt || endAt
      ? {
          createdAt: {
            ...(startAt ? { gte: startAt } : {}),
            ...(endAt ? { lt: endAt } : {}),
          },
        }
      : {};

  const [exposureEvents, conversionEvents] = await Promise.all([
    db.websiteEvent.findMany({
      where: {
        websiteId: experiment.websiteId,
        eventName: EXPOSURE_EVENT_NAME,
        ...range,
      },
      select: {
        sessionId: true,
        createdAt: true,
        eventData: { select: { dataKey: true, stringValue: true } },
      },
      take: 200000,
    }),
    db.websiteEvent.findMany({
      where: {
        websiteId: experiment.websiteId,
        eventName: experiment.conversionEvent,
        ...range,
      },
      select: { sessionId: true, createdAt: true },
      take: 200000,
    }),
  ]);

  // COR-3: a conversion only counts for a variant when it happened at
  // or after that session's first exposure to the variant. Counting
  // sessions that converted before ever being exposed inflated every
  // variant's conversion rate.
  const firstConversionAt = new Map<string, number>();
  for (const e of conversionEvents as any[]) {
    const t = new Date(e.createdAt).getTime();
    if (!firstConversionAt.has(e.sessionId) || t < firstConversionAt.get(e.sessionId)!) {
      firstConversionAt.set(e.sessionId, t);
    }
  }

  // variant key -> set of exposed session ids, plus each session's
  // first exposure time per variant
  const exposedByVariant = new Map<string, Set<string>>();
  const firstExposureAt = new Map<string, Map<string, number>>();
  for (const event of exposureEvents as any[]) {
    let exp: string | null = null;
    let variant: string | null = null;
    for (const d of event.eventData) {
      if (d.dataKey === 'experiment') exp = d.stringValue;
      if (d.dataKey === 'variant') variant = d.stringValue;
    }
    if (exp !== experiment.key || !variant) continue;
    if (!exposedByVariant.has(variant)) exposedByVariant.set(variant, new Set());
    exposedByVariant.get(variant)!.add(event.sessionId);
    if (!firstExposureAt.has(variant)) firstExposureAt.set(variant, new Map());
    const perSession = firstExposureAt.get(variant)!;
    const t = new Date(event.createdAt).getTime();
    if (!perSession.has(event.sessionId) || t < perSession.get(event.sessionId)!) {
      perSession.set(event.sessionId, t);
    }
  }

  const controlKey =
    variants.find(v => v.control)?.key || variants[0]?.key;

  const raw = variants.map(v => {
    const sessions = exposedByVariant.get(v.key) || new Set<string>();
    const exposures = sessions.size;
    let conversions = 0;
    for (const s of sessions) {
      const convertedAt = firstConversionAt.get(s);
      const exposedAt = firstExposureAt.get(v.key)?.get(s);
      if (convertedAt !== undefined && exposedAt !== undefined && convertedAt >= exposedAt) {
        conversions++;
      }
    }
    return {
      key: v.key,
      name: v.name || v.key,
      control: v.key === controlKey,
      exposures,
      conversions,
      rate: exposures ? conversions / exposures : 0,
    };
  });

  const control = raw.find(r => r.control) || raw[0];
  const enoughData =
    raw.length > 0 && raw.every(r => r.exposures >= MIN_EXPOSURES) && !!control;

  const results: VariantResult[] = raw.map(r => {
    if (!control || r.key === control.key) {
      return { ...r, upliftPct: null, zScore: null, pValue: null, significant: null };
    }
    const test = twoProportionZTest(
      control.conversions,
      control.exposures,
      r.conversions,
      r.exposures,
    );
    return {
      ...r,
      upliftPct:
        control.rate > 0 ? Math.round(((r.rate - control.rate) / control.rate) * 1000) / 10 : null,
      zScore: test ? Math.round(test.z * 10000) / 10000 : null,
      pValue: test ? Math.round(test.p * 10000) / 10000 : null,
      significant: test ? test.p < 0.05 : null,
    };
  });

  return {
    experiment: {
      id: experiment.id,
      name: experiment.name,
      key: experiment.key,
      status: experiment.status,
      conversionEvent: experiment.conversionEvent,
    },
    controlKey: control?.key || null,
    minExposures: MIN_EXPOSURES,
    enoughData,
    results,
  };
}
