import { describe, expect, it } from 'vitest';
import { aggregateRevenueRows } from '../revenue';

// The seeded demo revenue: four USD purchase events totalling 185.74.
const ROWS = [
  {
    websiteEventId: 'e1',
    numberValue: 49.99,
    websiteEvent: {
      urlPath: '/pricing',
      referrerDomain: 'google.com',
      sessionId: 's1',
      createdAt: new Date('2026-11-10T10:00:00Z'),
    },
  },
  {
    websiteEventId: 'e2',
    numberValue: 99.0,
    websiteEvent: {
      urlPath: '/pricing',
      referrerDomain: null,
      sessionId: 's1',
      createdAt: new Date('2026-11-10T11:00:00Z'),
    },
  },
  {
    websiteEventId: 'e3',
    numberValue: 25.5,
    websiteEvent: {
      urlPath: '/checkout',
      referrerDomain: 'google.com',
      sessionId: 's2',
      createdAt: new Date('2026-11-11T09:00:00Z'),
    },
  },
  {
    websiteEventId: 'e4',
    numberValue: 11.25,
    websiteEvent: {
      urlPath: '/',
      referrerDomain: null,
      sessionId: 's2',
      createdAt: new Date('2026-11-11T12:00:00Z'),
    },
  },
];

describe('aggregateRevenueRows', () => {
  it('sums the seeded fixture to USD 185.74 over 4 events / 2 visitors', () => {
    const report = aggregateRevenueRows(ROWS as any, new Map(), 'USD');
    expect(report.currency).toBe('USD');
    expect(report.total).toBe(185.74);
    expect(report.eventCount).toBe(4);
    expect(report.visitors).toBe(2);
    expect(report.avgPerVisitor).toBe(92.87);
    expect(report.otherCurrencies).toEqual([]);
  });

  it('breaks down by day and page', () => {
    const report = aggregateRevenueRows(ROWS as any, new Map(), 'USD');
    expect(report.byDay).toEqual([
      { name: '2026-11-10', total: 148.99, count: 2 },
      { name: '2026-11-11', total: 36.75, count: 2 },
    ]);
    expect(report.byPage[0]).toEqual({ name: '/pricing', total: 148.99, count: 2 });
  });

  it('routes currency overrides into otherCurrencies', () => {
    const overrides = new Map([['e4', 'EUR']]);
    const report = aggregateRevenueRows(ROWS as any, overrides, 'USD');
    expect(report.total).toBe(174.49);
    expect(report.otherCurrencies).toEqual([{ currency: 'EUR', total: 11.25, eventCount: 1 }]);
  });

  it('empty input yields a zeroed report', () => {
    const report = aggregateRevenueRows([], new Map(), 'USD');
    expect(report.total).toBe(0);
    expect(report.eventCount).toBe(0);
    expect(report.byDay).toEqual([]);
  });
});
