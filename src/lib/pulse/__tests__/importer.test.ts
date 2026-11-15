import { describe, expect, it } from 'vitest';
import { PRESETS, mapImportRow, parseCsv } from '../importer';

// Fixtures in the real export formats the presets target:
// - GA4 "Pages and screens" export: Date is YYYYMMDD, counts under "Views".
// - Plausible pages export: Pathname / Pageviews / Visitors columns.
const GA4_CSV = [
  'Date,Page path,Views,Country,Device category,Session source',
  '20260101,/pricing,10,US,desktop,google',
  '20260102,/blog/hello,15,IN,mobile,(direct)',
].join('\n');

const PLAUSIBLE_CSV = [
  'Date,Pathname,Pageviews,Visitors,Referrer,Country,Browser,Operating system,Device',
  '2026-01-01,/,3,2,google.com,US,Chrome,Windows,desktop',
  '2026-01-02,/about,2,1,,GB,Safari,Mac,desktop',
].join('\n');

describe('parseCsv', () => {
  it('parses the GA4 fixture into 2 rows keyed by header', () => {
    const rows = parseCsv(GA4_CSV);
    expect(rows).toHaveLength(2);
    expect(rows[0]['Page path']).toBe('/pricing');
    expect(rows[1]['Date']).toBe('20260102');
  });

  it('handles quoted fields with embedded commas', () => {
    const rows = parseCsv('a,b\n"x, y",2');
    expect(rows).toHaveLength(1);
    expect(rows[0].a).toBe('x, y');
  });
});

describe('mapImportRow with presets', () => {
  it('GA4: maps dates (YYYYMMDD), paths and view counts', () => {
    const rows = parseCsv(GA4_CSV);
    const mapped = rows.map(r => mapImportRow(r, PRESETS.ga4));
    expect(mapped.every(m => m !== null)).toBe(true);
    const total = mapped.reduce((sum, m) => sum + (m?.count || 0), 0);
    expect(total).toBe(25);
    expect(mapped[0]?.date.toISOString()).toBe('2026-01-01T10:00:00.000Z');
    expect(mapped[0]?.path).toBe('/pricing');
    expect(mapped[0]?.referrerDomain).toBe('google');
    // GA4 "(direct)" referrers are dropped
    expect(mapped[1]?.referrerDomain).toBeUndefined();
    expect(mapped[1]?.device).toBe('mobile');
    expect(mapped[1]?.country).toBe('IN');
  });

  it('Plausible: maps pageviews and clamps sessions to visitors', () => {
    const rows = parseCsv(PLAUSIBLE_CSV);
    const mapped = rows.map(r => mapImportRow(r, PRESETS.plausible));
    const total = mapped.reduce((sum, m) => sum + (m?.count || 0), 0);
    expect(total).toBe(5);
    expect(mapped[0]?.sessionCount).toBe(2);
    expect(mapped[0]?.referrerDomain).toBe('google.com');
    expect(mapped[0]?.browser).toBe('Chrome');
    expect(mapped[0]?.os).toBe('Windows');
    expect(mapped[1]?.sessionCount).toBe(1);
    expect(mapped[1]?.referrerDomain).toBeUndefined();
  });

  it('rows without a valid date are rejected', () => {
    expect(mapImportRow({ Date: 'not-a-date', Views: '5' }, PRESETS.ga4)).toBeNull();
    expect(mapImportRow({ Views: '5' }, PRESETS.ga4)).toBeNull();
  });
});
