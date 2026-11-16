import { describe, expect, it } from 'vitest';
import {
  explainResult,
  parseQuestion,
  resolveRange,
  sanitizeFilter,
  validatePlan,
  type AskResult,
  type QueryPlan,
} from '../assistant';

// Fixed "now": Monday 16 November 2026, noon local time.
const NOW = new Date(2026, 10, 16, 12, 0, 0);

function planOf(question: string): QueryPlan {
  const outcome = parseQuestion(question, NOW);
  if (!('plan' in outcome)) throw new Error(`expected a plan, got refusal: ${(outcome as any).refusal}`);
  return outcome.plan;
}

describe('parseQuestion: question -> plan mapping', () => {
  it('maps "top pages this month" to a top/page/thisMonth plan', () => {
    const plan = planOf('Which pages got the most views this month?');
    expect(plan.intent).toBe('top');
    expect(plan.dimension).toBe('page');
    expect(plan.range).toBe('thisMonth');
    expect(plan.metric).toBe('pageviews');
  });

  it('maps "visitors from Google this week" to a filtered summary', () => {
    const plan = planOf('How many visitors came from Google this week?');
    expect(plan.intent).toBe('summary');
    expect(plan.metric).toBe('visitors');
    expect(plan.range).toBe('thisWeek');
    expect(plan.filterValue).toBe('google');
  });

  it('maps a "why did traffic drop" question to a compare plan', () => {
    const plan = planOf('Why did traffic drop last Tuesday?');
    expect(plan.intent).toBe('compare');
    expect(plan.range).toBe('specificDay');
    expect(plan.weekday).toBe(2);
  });

  it('maps bounce rate questions to the bounceRate metric', () => {
    const plan = planOf('What is my bounce rate this month?');
    expect(plan.intent).toBe('summary');
    expect(plan.metric).toBe('bounceRate');
    expect(plan.range).toBe('thisMonth');
  });

  it('maps per-day questions to a trend plan', () => {
    const plan = planOf('Show me pageviews per day this week');
    expect(plan.intent).toBe('trend');
    expect(plan.dimension).toBe('day');
    expect(plan.range).toBe('thisWeek');
  });

  it('maps top referrers with an explicit day count', () => {
    const plan = planOf('What are my top referrers in the last 30 days?');
    expect(plan.intent).toBe('top');
    expect(plan.dimension).toBe('referrer');
    expect(plan.range).toBe('lastNDays');
    expect(plan.days).toBe(30);
  });

  it('maps a plain total question to a summary with the right range', () => {
    const plan = planOf('How many pageviews did I get yesterday?');
    expect(plan.intent).toBe('summary');
    expect(plan.metric).toBe('pageviews');
    expect(plan.range).toBe('yesterday');
  });

  it('clamps an out-of-range day count to 90', () => {
    const plan = planOf('How many visitors in the last 400 days?');
    expect(plan.days).toBe(90);
  });
});

describe('parseQuestion: honest refusals', () => {
  it('refuses forecasts', () => {
    const outcome = parseQuestion('Will my traffic grow next month? Can you predict it?', NOW);
    expect('refusal' in outcome).toBe(true);
  });

  it('refuses revenue questions and points elsewhere', () => {
    const outcome = parseQuestion('How much revenue did I make this week?', NOW);
    expect('refusal' in outcome).toBe(true);
    if ('refusal' in outcome) expect(outcome.refusal).toMatch(/Revenue/);
  });

  it('refuses to identify individual visitors', () => {
    const outcome = parseQuestion('Who is my most frequent visitor and what is their email address?', NOW);
    expect('refusal' in outcome).toBe(true);
  });

  it('refuses questions it cannot map to any supported pattern', () => {
    const outcome = parseQuestion('Tell me something interesting please', NOW);
    expect('refusal' in outcome).toBe(true);
  });
});

describe('resolveRange', () => {
  it('resolves "last Tuesday" from a Monday to 6 days earlier, single day', () => {
    const r = resolveRange({ range: 'specificDay', weekday: 2 }, NOW);
    expect(r.startAt.getFullYear()).toBe(2026);
    expect(r.startAt.getMonth()).toBe(10);
    expect(r.startAt.getDate()).toBe(10);
    expect(r.endAt.getDate()).toBe(11);
    // Previous period is the equally-sized period right before.
    expect(r.prevEndAt.getTime()).toBe(r.startAt.getTime());
    expect(r.prevStartAt.getDate()).toBe(9);
  });

  it('resolves yesterday as the full previous day', () => {
    const r = resolveRange({ range: 'yesterday' }, NOW);
    expect(r.startAt.getDate()).toBe(15);
    expect(r.endAt.getDate()).toBe(16);
  });

  it('resolves thisMonth from the 1st to tomorrow', () => {
    const r = resolveRange({ range: 'thisMonth' }, NOW);
    expect(r.startAt.getDate()).toBe(1);
    expect(r.startAt.getMonth()).toBe(10);
    expect(r.endAt.getDate()).toBe(17);
  });

  it('resolves lastNDays inclusively ending today', () => {
    const r = resolveRange({ range: 'lastNDays', days: 7 }, NOW);
    expect(r.startAt.getDate()).toBe(10);
    expect(r.endAt.getDate()).toBe(17);
  });
});

describe('validatePlan: the allow-list gate for any plan source', () => {
  it('accepts a fully allow-listed plan and clamps the limit', () => {
    const plan = validatePlan({
      intent: 'top',
      metric: 'pageviews',
      dimension: 'page',
      range: 'thisMonth',
      limit: 500,
    });
    expect(plan).not.toBeNull();
    expect(plan?.limit).toBe(20);
  });

  it('rejects anything outside the allow-lists (e.g. an injected metric)', () => {
    expect(
      validatePlan({ intent: 'summary', metric: 'pageviews; DROP TABLE', dimension: 'none', range: 'today' }),
    ).toBeNull();
    expect(validatePlan({ intent: 'rawSql', metric: 'pageviews', dimension: 'none', range: 'today' })).toBeNull();
    expect(validatePlan({ intent: 'summary', metric: 'pageviews', dimension: 'password', range: 'today' })).toBeNull();
    expect(validatePlan(null)).toBeNull();
    expect(validatePlan('SELECT * FROM website_event')).toBeNull();
  });

  it('rejects a specificDay plan without a valid weekday', () => {
    expect(
      validatePlan({ intent: 'summary', metric: 'pageviews', dimension: 'none', range: 'specificDay', weekday: 9 }),
    ).toBeNull();
  });

  it('sanitizes the referrer filter', () => {
    const plan = validatePlan({
      intent: 'summary',
      metric: 'visitors',
      dimension: 'none',
      range: 'thisWeek',
      filterValue: 'Google!!\'; DROP',
    });
    expect(plan?.filterValue).toBe('googledrop');
  });
});

describe('sanitizeFilter', () => {
  it('strips unsafe characters and rejects too-short tokens', () => {
    expect(sanitizeFilter('google.com')).toBe('google.com');
    expect(sanitizeFilter('a')).toBeUndefined();
    expect(sanitizeFilter('!!!')).toBeUndefined();
    expect(sanitizeFilter(undefined)).toBeUndefined();
  });
});

describe('explainResult: numbers come only from the result', () => {
  it('explains a top result using the executed rows', () => {
    const plan: QueryPlan = { intent: 'top', metric: 'pageviews', dimension: 'page', range: 'thisMonth', limit: 10 };
    const result: AskResult = {
      rows: [
        { name: '/pricing', value: 40 },
        { name: '/', value: 10 },
      ],
      total: 50,
    };
    const text = explainResult(plan, result, 'this month');
    expect(text).toContain('/pricing');
    expect(text).toContain('40');
    expect(text).toContain('80%');
  });

  it('explains a compare result with the real delta', () => {
    const plan: QueryPlan = { intent: 'compare', metric: 'pageviews', dimension: 'none', range: 'specificDay', weekday: 2, limit: 10 };
    const result: AskResult = {
      rows: [
        { name: 'Pageviews', value: 80, previous: 100 },
        { name: 'Page: /blog', value: 10, previous: 30 },
      ],
      total: 80,
      previousTotal: 100,
    };
    const text = explainResult(plan, result, 'Tuesday Nov 10, 2026');
    expect(text).toContain('fell 20%');
    expect(text).toContain('100');
    expect(text).toContain('80');
    expect(text).toContain('/blog');
  });

  it('says so honestly when there is no data', () => {
    const plan: QueryPlan = { intent: 'top', metric: 'pageviews', dimension: 'page', range: 'thisMonth', limit: 10 };
    const text = explainResult(plan, { rows: [], total: 0 }, 'this month');
    expect(text).toMatch(/nothing to rank/);
  });
});
