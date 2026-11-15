import { getUptimeSummary } from '@/lib/pulse/uptime';
import { pulseDb } from '@/lib/pulse/stats';
import { parseRequest } from '@/lib/request';

// Public status page for one website, gated by the same per-site token as
// the live badge. Implemented as a route handler (not a React page) so the
// HTTP status is exact: 200 with a valid token, 404 without one.

const esc = (v: any) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const pageShell = (title: string, body: string) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(title)} | Pulse</title>
</head>
<body style="margin:0;background:#f7f7fb;color:#191919;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">
<main style="min-height:100vh;padding:40px 20px;box-sizing:border-box;">
<div style="max-width:760px;margin:0 auto;">
<div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);border-radius:14px;padding:22px 26px;color:#fff;display:flex;justify-content:space-between;align-items:center;">
<div style="font-size:22px;font-weight:700;letter-spacing:0.2px;">pulse</div>
<div style="font-size:13px;opacity:0.85;">Service status</div>
</div>
${body}
</div>
</main>
</body>
</html>`;

const card = (inner: string) =>
  `<div style="background:#fff;border:1px solid #e5e5ef;border-radius:14px;padding:26px;margin-top:18px;">${inner}</div>`;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ websiteId: string }> },
) {
  await parseRequest(request, undefined, { skipAuth: true });

  const { websiteId } = await params;
  const url = new URL(request.url);
  const token = url.searchParams.get('token');

  const db = pulseDb();
  const setting = await db.pulseSiteSetting.findUnique({ where: { websiteId } });

  if (!setting || !setting.badgeEnabled || !setting.badgeToken || token !== setting.badgeToken) {
    return new Response(
      pageShell(
        'Status not found',
        card(
          `<h1 style="font-size:22px;margin:0 0 8px;">Status page not found</h1>` +
            `<p style="color:#6b7280;font-size:14px;margin:0;">This status page does not exist or is not enabled. ` +
            `A valid per-site token is required to view it.</p>`,
        ),
      ),
      { status: 404, headers: { 'content-type': 'text/html; charset=utf-8' } },
    );
  }

  const website = await db.website.findUnique({
    where: { id: websiteId },
    select: { name: true, domain: true },
  });
  if (!website) {
    return new Response(pageShell('Status not found', card('<h1>Not found</h1>')), {
      status: 404,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  }

  const summary = await getUptimeSummary(websiteId);
  const checks = [...(summary.recentChecks || [])].slice(0, 20);
  const strip = [...checks].reverse();
  const status = summary.currentStatus;
  const statusColor = status === 'up' ? '#16a34a' : status === 'down' ? '#dc2626' : '#6b7280';
  const statusText =
    status === 'up'
      ? '● All systems operational'
      : status === 'down'
        ? '● Outage detected'
        : '● Status unknown';
  const fmt = (v: any) => (v ? new Date(v).toLocaleString() : '—');
  const pct = (v: number | null) => (v != null ? `${v}%` : '—');
  const last = summary.lastCheck;
  const openIncidents = (summary.incidents || []).filter((i: any) => !i.endedAt).length;

  const statCard = (label: string, value: string, sub: string) =>
    `<div style="flex:1 1 180px;border:1px solid #e5e5ef;border-radius:10px;padding:16px;">` +
    `<div style="font-size:13px;font-weight:600;">${label}</div>` +
    `<div style="font-size:24px;font-weight:700;margin-top:4px;">${value}</div>` +
    `<div style="font-size:12px;color:#6b7280;">${sub}</div></div>`;

  const stripHtml = strip
    .map(
      (c: any) =>
        `<div title="${esc(fmt(c.createdAt))} — ${c.up ? 'Up' : 'Down'}${c.status ? ` (HTTP ${c.status})` : ''}, ${c.responseMs} ms" style="flex:1;height:28px;border-radius:3px;background:${c.up ? '#22c55e' : '#ef4444'};"></div>`,
    )
    .join('');

  const rowsHtml = checks
    .map(
      (c: any) =>
        `<tr>` +
        `<td style="padding:8px 10px;border-bottom:1px solid #f0f0f5;">${esc(fmt(c.createdAt))}</td>` +
        `<td style="padding:8px 10px;border-bottom:1px solid #f0f0f5;">${c.up ? '✅ Up' : '❌ Down'}</td>` +
        `<td style="padding:8px 10px;border-bottom:1px solid #f0f0f5;">${c.status ?? '—'}</td>` +
        `<td style="padding:8px 10px;border-bottom:1px solid #f0f0f5;">${c.responseMs} ms</td>` +
        `<td style="padding:8px 10px;border-bottom:1px solid #f0f0f5;">${esc(c.error || '—')}</td>` +
        `</tr>`,
    )
    .join('');

  const checksSection = checks.length
    ? `<div style="display:flex;gap:3px;margin-bottom:14px;">${stripHtml}</div>` +
      `<table style="width:100%;border-collapse:collapse;font-size:14px;"><thead><tr>` +
      ['Time', 'Result', 'HTTP status', 'Response', 'Error']
        .map(
          h =>
            `<th style="text-align:left;padding:8px 10px;border-bottom:2px solid #e5e5ef;">${h}</th>`,
        )
        .join('') +
      `</tr></thead><tbody>${rowsHtml}</tbody></table>`
    : `<p style="color:#6b7280;font-size:14px;">No uptime checks have run for this website yet.</p>`;

  const body = card(
    `<h1 style="font-size:24px;margin:0 0 4px;">${esc(website.name)}</h1>` +
      `<div style="color:#6b7280;font-size:14px;">${esc(website.domain || '')}</div>` +
      `<div style="margin-top:20px;font-size:30px;font-weight:700;color:${statusColor};">${statusText}</div>` +
      `<div style="color:#6b7280;font-size:14px;margin-top:4px;">${
        last
          ? `Last checked ${esc(fmt(last.createdAt))} · ${last.responseMs} ms${last.status ? ` · HTTP ${last.status}` : ''}${last.error ? ` · ${esc(last.error)}` : ''}`
          : 'No checks recorded yet.'
      }</div>` +
      `<div style="display:flex;gap:14px;margin-top:22px;flex-wrap:wrap;">` +
      statCard('Uptime (24h)', pct(summary.uptime24h), `${summary.checks24h} checks`) +
      statCard('Uptime (30 days)', pct(summary.uptime30d), `${summary.checks30d} checks`) +
      statCard('Open incidents', String(openIncidents), `${(summary.incidents || []).length} total recorded`) +
      `</div>` +
      `<h2 style="font-size:16px;margin:26px 0 10px;">Recent checks</h2>` +
      checksSection +
      `<p style="color:#9ca3af;font-size:12px;margin-top:22px;">Status provided by Pulse Analytics uptime monitoring.</p>`,
  );

  return new Response(pageShell(`${website.name} status`, body), {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=60',
    },
  });
}
