import { createHash, createHmac, createSign } from 'node:crypto';
import { uuid } from '@/lib/crypto';
import { logAudit } from './audit';
import { pulseDb } from './stats';
import { assertPublicUrl } from './url-guard';

// Data warehouse export: serialises a website's events (with their event
// data) to NDJSON or CSV and ships them to an S3-compatible bucket (AWS
// Signature V4, implemented by hand with node:crypto — works with AWS S3,
// MinIO, Cloudflare R2, …) or into BigQuery (service-account JWT -> OAuth
// token exchange + streaming insert). No new dependencies.
//
// BigQuery endpoints can be overridden for testing/self-hosting:
//   PULSE_BIGQUERY_TOKEN_URL (default https://oauth2.googleapis.com/token)
//   PULSE_BIGQUERY_API_BASE  (default https://bigquery.googleapis.com)

export interface ExportRow {
  id: string;
  sessionId: string;
  visitId: string;
  createdAt: string;
  urlPath: string;
  urlQuery: string | null;
  referrerDomain: string | null;
  referrerPath: string | null;
  pageTitle: string | null;
  eventType: number;
  eventName: string | null;
  hostname: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  data: Record<string, any>;
}

export async function collectExportRows(
  websiteId: string,
  startAt: Date,
  endAt: Date,
): Promise<ExportRow[]> {
  const db = pulseDb();

  const events = await db.websiteEvent.findMany({
    where: { websiteId, createdAt: { gte: startAt, lt: endAt } },
    orderBy: { createdAt: 'asc' },
    take: 200000,
    select: {
      id: true,
      sessionId: true,
      visitId: true,
      createdAt: true,
      urlPath: true,
      urlQuery: true,
      referrerDomain: true,
      referrerPath: true,
      pageTitle: true,
      eventType: true,
      eventName: true,
      hostname: true,
      utmSource: true,
      utmMedium: true,
      utmCampaign: true,
      eventData: { select: { dataKey: true, stringValue: true, numberValue: true, dateValue: true } },
    },
  });

  return (events as any[]).map(e => ({
    id: e.id,
    sessionId: e.sessionId,
    visitId: e.visitId,
    createdAt: e.createdAt ? new Date(e.createdAt).toISOString() : null,
    urlPath: e.urlPath,
    urlQuery: e.urlQuery,
    referrerDomain: e.referrerDomain,
    referrerPath: e.referrerPath,
    pageTitle: e.pageTitle,
    eventType: e.eventType,
    eventName: e.eventName,
    hostname: e.hostname,
    utmSource: e.utmSource,
    utmMedium: e.utmMedium,
    utmCampaign: e.utmCampaign,
    data: Object.fromEntries(
      (e.eventData || []).map((d: any) => [
        d.dataKey,
        d.stringValue ?? (d.numberValue != null ? Number(d.numberValue) : d.dateValue),
      ]),
    ),
  }));
}

const CSV_COLUMNS: (keyof ExportRow)[] = [
  'id',
  'sessionId',
  'visitId',
  'createdAt',
  'urlPath',
  'urlQuery',
  'referrerDomain',
  'referrerPath',
  'pageTitle',
  'eventType',
  'eventName',
  'hostname',
  'utmSource',
  'utmMedium',
  'utmCampaign',
  'data',
];

export function formatExport(rows: ExportRow[], format: string): string {
  if (format === 'csv') {
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [CSV_COLUMNS.join(',')];
    for (const row of rows) {
      lines.push(
        CSV_COLUMNS.map(c => esc(c === 'data' ? JSON.stringify(row.data) : (row as any)[c])).join(
          ',',
        ),
      );
    }
    return lines.join('\n') + '\n';
  }
  return rows.map(r => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : '');
}

// ---------- S3 (AWS Signature V4) ----------

export const sha256Hex = (data: string | Buffer) =>
  createHash('sha256').update(data).digest('hex');
export const hmacSha256 = (key: Buffer | string, data: string) =>
  createHmac('sha256', key).update(data).digest();

// AWS Signature V4 signing-key derivation:
// kSigning = HMAC(HMAC(HMAC(HMAC("AWS4" + secret, date), region), service), "aws4_request")
export function deriveSigV4SigningKey(
  secretAccessKey: string,
  dateStamp: string,
  region: string,
  service: string,
): Buffer {
  const kDate = hmacSha256(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, service);
  return hmacSha256(kService, 'aws4_request');
}

export async function s3PutObject(
  config: any,
  key: string,
  body: string,
  contentType: string,
): Promise<{ status: number }> {
  const endpoint = String(config.endpoint || 'https://s3.amazonaws.com').replace(/\/$/, '');
  const bucket = String(config.bucket || '');
  const region = String(config.region || 'us-east-1');
  const accessKeyId = String(config.accessKeyId || '');
  const secretAccessKey = String(config.secretAccessKey || '');
  if (!bucket || !accessKeyId || !secretAccessKey) {
    throw new Error('S3 config requires bucket, accessKeyId and secretAccessKey.');
  }

  const url = new URL(`${endpoint}/${bucket}/${key}`);
  // SSRF guard: the S3 endpoint is user-supplied export config.
  await assertPublicUrl(url.toString());
  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256Hex(body);

  const headers: Record<string, string> = {
    host: url.host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
  };
  const signedHeaders = Object.keys(headers).sort().join(';');
  const canonicalHeaders = Object.keys(headers)
    .sort()
    .map(k => `${k}:${headers[k]}\n`)
    .join('');

  const canonicalRequest = [
    'PUT',
    url.pathname,
    url.search.replace(/^\?/, ''),
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const scope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256Hex(canonicalRequest)].join('\n');

  const kSigning = deriveSigV4SigningKey(secretAccessKey, dateStamp, region, 's3');
  const signature = createHmac('sha256', kSigning).update(stringToSign).digest('hex');

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      ...headers,
      'content-type': contentType,
      authorization:
        `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, ` +
        `SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`S3 PUT failed with HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  await res.text().catch(() => '');
  return { status: res.status };
}

// ---------- BigQuery (service account JWT -> OAuth -> insertAll) ----------

const base64url = (input: string | Buffer) =>
  Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export async function bigQueryInsert(
  config: any,
  rows: ExportRow[],
): Promise<{ status: number; inserted: number }> {
  const tokenUrl = process.env.PULSE_BIGQUERY_TOKEN_URL || 'https://oauth2.googleapis.com/token';
  const apiBase = (process.env.PULSE_BIGQUERY_API_BASE || 'https://bigquery.googleapis.com').replace(
    /\/$/,
    '',
  );

  const email = String(config.serviceAccountEmail || '');
  const privateKey = String(config.privateKey || '');
  const project = String(config.project || '');
  const dataset = String(config.dataset || '');
  const table = String(config.table || '');
  if (!email || !privateKey || !project || !dataset || !table) {
    throw new Error(
      'BigQuery config requires serviceAccountEmail, privateKey, project, dataset and table.',
    );
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(
    JSON.stringify({
      iss: email,
      scope: 'https://www.googleapis.com/auth/bigquery',
      aud: tokenUrl,
      iat: nowSec,
      exp: nowSec + 3600,
    }),
  );
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claims}`);
  const signature = base64url(signer.sign(privateKey.replace(/\\n/g, '\n')) as any);
  const assertion = `${header}.${claims}.${signature}`;

  const tokenRes = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!tokenRes.ok) {
    const text = await tokenRes.text().catch(() => '');
    throw new Error(`BigQuery token exchange failed with HTTP ${tokenRes.status}: ${text.slice(0, 300)}`);
  }
  const tokenJson: any = await tokenRes.json();
  const accessToken = tokenJson.access_token;
  if (!accessToken) throw new Error('BigQuery token exchange returned no access_token.');

  // insertAll in chunks to stay within request limits.
  let inserted = 0;
  let lastStatus = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const res = await fetch(
      `${apiBase}/bigquery/v2/projects/${project}/datasets/${dataset}/tables/${table}/insertAll`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          kind: 'bigquery#tableDataInsertAllRequest',
          skipInvalidRows: false,
          rows: chunk.map(row => ({ insertId: row.id, json: row })),
        }),
      },
    );
    lastStatus = res.status;
    const text = await res.text().catch(() => '');
    if (!res.ok) {
      throw new Error(`BigQuery insertAll failed with HTTP ${res.status}: ${text.slice(0, 300)}`);
    }
    let parsed: any = {};
    try {
      parsed = JSON.parse(text || '{}');
    } catch {
      /* non-JSON success body */
    }
    if (Array.isArray(parsed.insertErrors) && parsed.insertErrors.length) {
      throw new Error(
        `BigQuery insertAll reported ${parsed.insertErrors.length} row error(s): ` +
          JSON.stringify(parsed.insertErrors[0]).slice(0, 300),
      );
    }
    inserted += chunk.length;
  }

  return { status: lastStatus || 200, inserted };
}

// ---------- Job runner ----------

export async function runExportJob(job: any, auth: any, rangeDays = 30) {
  const db = pulseDb();
  const config = (job.config || {}) as any;

  const endAt = new Date();
  const startAt = new Date(endAt.getTime() - Math.max(1, rangeDays) * 86400_000);

  let log: any;
  try {
    const rows = await collectExportRows(job.websiteId, startAt, endAt);
    const body = formatExport(rows, job.format);
    const bytes = Buffer.byteLength(body, 'utf8');

    if (job.destination === 's3') {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const key = `${String(config.prefix || 'pulse-export').replace(/\/$/, '')}/${job.websiteId}-${stamp}.${job.format === 'csv' ? 'csv' : 'ndjson'}`;
      await s3PutObject(
        config,
        key,
        body,
        job.format === 'csv' ? 'text/csv' : 'application/x-ndjson',
      );
    } else if (job.destination === 'bigquery') {
      await bigQueryInsert(config, rows);
    } else {
      throw new Error(`Unknown destination: ${job.destination}`);
    }

    log = await db.pulseExportLog.create({
      data: {
        id: uuid(),
        jobId: job.id,
        websiteId: job.websiteId,
        destination: job.destination,
        format: job.format,
        rowsExported: rows.length,
        bytes,
        status: 'success',
      },
    });

    await db.pulseExportJob.update({ where: { id: job.id }, data: { lastRunAt: new Date() } });

    await logAudit(auth, 'warehouse_export', job.websiteId, {
      jobId: job.id,
      jobName: job.name,
      destination: job.destination,
      format: job.format,
      rowsExported: rows.length,
      bytes,
      status: 'success',
    });

    return { ok: true, log };
  } catch (e: any) {
    const message = String(e?.message || e).slice(0, 900);
    log = await db.pulseExportLog.create({
      data: {
        id: uuid(),
        jobId: job.id,
        websiteId: job.websiteId,
        destination: job.destination,
        format: job.format,
        rowsExported: 0,
        bytes: 0,
        status: 'failed',
        error: message,
      },
    });

    await logAudit(auth, 'warehouse_export', job.websiteId, {
      jobId: job.id,
      jobName: job.name,
      destination: job.destination,
      format: job.format,
      status: 'failed',
      error: message,
    });

    return { ok: false, log, error: message };
  }
}
