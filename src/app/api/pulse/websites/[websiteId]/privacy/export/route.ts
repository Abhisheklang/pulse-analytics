import { logAudit } from '@/lib/pulse/audit';
import { pulseDb } from '@/lib/pulse/stats';
import { parseRequest } from '@/lib/request';
import { unauthorized } from '@/lib/response';
import { canUpdateWebsite } from '@/permissions';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ websiteId: string }> },
) {
  const { auth, error } = await parseRequest(request);
  if (error) return error();

  const { websiteId } = await params;
  // Raw event export (up to 50,000 rows) is update-level only: view-level
  // callers and share-token holders must never download raw event history.
  if (!(await canUpdateWebsite(auth, websiteId))) return unauthorized();

  const url = new URL(request.url);
  const format = url.searchParams.get('format') === 'json' ? 'json' : 'csv';
  const startAt = url.searchParams.get('startAt');
  const endAt = url.searchParams.get('endAt');

  const where: any = { websiteId };
  if (startAt || endAt) {
    where.createdAt = {
      ...(startAt ? { gte: new Date(Number(startAt)) } : {}),
      ...(endAt ? { lt: new Date(Number(endAt)) } : {}),
    };
  }

  const events = await pulseDb().websiteEvent.findMany({
    where,
    orderBy: { createdAt: 'asc' },
    take: 50000,
    select: {
      id: true,
      sessionId: true,
      createdAt: true,
      urlPath: true,
      urlQuery: true,
      referrerDomain: true,
      pageTitle: true,
      eventType: true,
      eventName: true,
      hostname: true,
    },
  });

  await logAudit(auth, 'data_export', websiteId, {
    format,
    eventsExported: events.length,
    startAt: startAt || null,
    endAt: endAt || null,
  });

  if (format === 'json') {
    return new Response(JSON.stringify(events, null, 2), {
      headers: {
        'content-type': 'application/json',
        'content-disposition': `attachment; filename="pulse-export-${websiteId}.json"`,
      },
    });
  }

  const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const header = 'id,sessionId,createdAt,urlPath,urlQuery,referrerDomain,pageTitle,eventType,eventName,hostname';
  const lines = events.map((e: any) =>
    [e.id, e.sessionId, e.createdAt?.toISOString(), e.urlPath, e.urlQuery, e.referrerDomain, e.pageTitle, e.eventType, e.eventName, e.hostname]
      .map(esc)
      .join(','),
  );

  return new Response([header, ...lines].join('\n'), {
    headers: {
      'content-type': 'text/csv',
      'content-disposition': `attachment; filename="pulse-export-${websiteId}.csv"`,
    },
  });
}
