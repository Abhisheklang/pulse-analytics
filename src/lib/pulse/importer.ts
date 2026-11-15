import { uuid } from '@/lib/crypto';
import { pulseDb } from './stats';

const db = () => pulseDb();

export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  const input = text.replace(/^\uFEFF/, '');

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
    } else if (ch !== '\r') {
      field += ch;
    }
  }

  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }

  const nonEmpty = rows.filter(r => r.some(c => c.trim() !== ''));
  if (nonEmpty.length < 2) return [];

  const headers = nonEmpty[0].map(h => h.trim());

  return nonEmpty.slice(1).map(r => {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = (r[idx] ?? '').trim();
    });
    return obj;
  });
}

export const PRESETS: Record<string, Record<string, string[]>> = {
  ga4: {
    date: ['Date', 'date'],
    path: ['Page path', 'Page', 'Landing page', 'Page location'],
    count: ['Views', 'Screen views', 'Pageviews', 'Sessions'],
    referrer: ['Session source', 'Referrer', 'Source'],
    country: ['Country'],
    device: ['Device category', 'Device'],
  },
  plausible: {
    date: ['Date', 'date'],
    path: ['Pathname', 'Page', 'pathname'],
    count: ['Pageviews', 'pageviews'],
    visitors: ['Visitors', 'visitors'],
    referrer: ['Referrer', 'Source', 'referrer'],
    country: ['Country'],
    browser: ['Browser'],
    os: ['Operating system', 'OS'],
    device: ['Device'],
  },
  matomo: {
    date: ['Date', 'date'],
    path: ['Page URL', 'URL', 'url', 'Page'],
    count: ['Hits', 'nb_hits', 'Pageviews'],
    referrer: ['Referrer', 'referrer'],
    country: ['Country', 'country'],
    browser: ['Browser', 'browser'],
    os: ['Operating system', 'os'],
    device: ['Device', 'device'],
  },
  generic: {
    date: ['date', 'Date'],
    path: ['url', 'path', 'URL', 'Page'],
    count: ['count', 'views', 'pageviews'],
    visitors: ['visitors'],
    referrer: ['referrer', 'Referrer'],
    country: ['country', 'Country'],
    browser: ['browser', 'Browser'],
    os: ['os', 'OS'],
    device: ['device', 'Device'],
  },
};

function pick(row: Record<string, string>, names?: string[]): string | undefined {
  if (!names) return undefined;
  for (const name of names) {
    if (row[name] !== undefined && row[name] !== '') return row[name];
  }
  return undefined;
}

function parseDate(value: string | undefined): Date | null {
  if (!value) return null;
  // GA4 exports use YYYYMMDD
  if (/^\d{8}$/.test(value)) {
    const y = value.slice(0, 4);
    const m = value.slice(4, 6);
    const d = value.slice(6, 8);
    const date = new Date(`${y}-${m}-${d}T10:00:00Z`);
    return isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date;
}

function toPath(value: string | undefined): string {
  if (!value) return '/';
  let path = value;
  try {
    if (/^https?:\/\//.test(path)) path = new URL(path).pathname;
  } catch {
    // keep as-is
  }
  if (!path.startsWith('/')) path = `/${path}`;
  return path.slice(0, 500);
}

function toReferrerDomain(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const v = value.trim().toLowerCase();
  if (!v || v === '(direct)' || v === 'direct' || v === '(none)' || v === 'none') return undefined;
  try {
    if (/^https?:\/\//.test(v)) return new URL(v).hostname.replace(/^www\./, '');
  } catch {
    // fall through
  }
  return v.replace(/^www\./, '').slice(0, 500);
}

export interface ImportResult {
  rowsImported: number;
  rowsSkipped: number;
  errors: string[];
}

export interface MappedImportRow {
  date: Date;
  path: string;
  count: number;
  sessionCount: number;
  referrerDomain?: string;
  browser: string;
  os: string;
  device: string;
  country: string;
}

// Pure per-row mapping through a source preset (unit-tested): resolves the
// preset's header aliases to a normalized pageview plan. Returns null when
// the row has no usable date.
export function mapImportRow(
  row: Record<string, string>,
  preset: Record<string, string[]>,
): MappedImportRow | null {
  const date = parseDate(pick(row, preset.date));
  if (!date) return null;

  const countRaw = parseInt(pick(row, preset.count) || '1', 10);
  const count = isNaN(countRaw) || countRaw < 1 ? 1 : Math.min(countRaw, 1000);
  const visitorsRaw = parseInt(pick(row, preset.visitors) || '0', 10);
  const sessionCount = Math.max(1, Math.min(isNaN(visitorsRaw) ? 1 : visitorsRaw, count));

  return {
    date,
    path: toPath(pick(row, preset.path)),
    count,
    sessionCount,
    referrerDomain: toReferrerDomain(pick(row, preset.referrer)),
    browser: (pick(row, preset.browser) || 'Chrome').slice(0, 20),
    os: (pick(row, preset.os) || 'Windows').slice(0, 20),
    device: (pick(row, preset.device) || 'desktop').slice(0, 20),
    country: (pick(row, preset.country) || 'US').slice(0, 2).toUpperCase(),
  };
}

const MAX_ROWS = 10000;

export async function importCsv(
  websiteId: string,
  source: string,
  csvText: string,
): Promise<ImportResult> {
  const preset = PRESETS[source] || PRESETS.generic;
  const rows = parseCsv(csvText);

  const website = await db().website.findUnique({ where: { id: websiteId } });
  const hostname = website?.domain || 'example.com';

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  const sessionsToCreate: any[] = [];
  const eventsToCreate: any[] = [];

  for (let i = 0; i < rows.length; i++) {
    const mapped = mapImportRow(rows[i], preset);

    if (!mapped) {
      skipped++;
      if (errors.length < 10) errors.push(`Row ${i + 2}: missing or invalid date`);
      continue;
    }

    const { date, path, count, sessionCount, referrerDomain } = mapped;

    if (imported + count > MAX_ROWS) {
      skipped++;
      if (errors.length < 10) errors.push(`Row ${i + 2}: import row cap (${MAX_ROWS}) reached`);
      continue;
    }

    const sessionIds: string[] = [];
    for (let s = 0; s < sessionCount; s++) {
      const sessionId = uuid();
      sessionIds.push(sessionId);
      sessionsToCreate.push({
        id: sessionId,
        websiteId,
        browser: mapped.browser,
        os: mapped.os,
        device: mapped.device,
        language: 'en-US',
        country: mapped.country,
        createdAt: date,
      });
    }

    for (let v = 0; v < count; v++) {
      const sessionId = sessionIds[v % sessionIds.length];
      eventsToCreate.push({
        id: uuid(),
        websiteId,
        sessionId,
        visitId: uuid(),
        createdAt: new Date(date.getTime() + v * 60_000),
        urlPath: path,
        referrerDomain,
        pageTitle: 'Imported pageview',
        eventType: 1,
        hostname,
      });
    }

    imported += count;
  }

  if (sessionsToCreate.length) {
    await db().session.createMany({ data: sessionsToCreate, skipDuplicates: true });
  }
  if (eventsToCreate.length) {
    await db().websiteEvent.createMany({ data: eventsToCreate, skipDuplicates: true });
  }

  const result = { rowsImported: imported, rowsSkipped: skipped, errors };

  await db().pulseImportLog.create({
    data: {
      id: uuid(),
      websiteId,
      source,
      rowsImported: imported,
      rowsSkipped: skipped,
      errors: errors.length ? errors : undefined,
    },
  });

  return result;
}
