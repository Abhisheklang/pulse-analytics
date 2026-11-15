import { pulseDb } from '@/lib/pulse/stats';
import { parseRequest } from '@/lib/request';
import { json, unauthorized } from '@/lib/response';
import { canViewWebsite } from '@/permissions';

// Live event debugger feed: the newest events for a website, newest first,
// with session dimensions and event data flattened for display.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ websiteId: string }> },
) {
  const { auth, error } = await parseRequest(request);
  if (error) return error();

  const { websiteId } = await params;
  if (!(await canViewWebsite(auth, websiteId))) return unauthorized();

  const url = new URL(request.url);
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit')) || 50));
  const filter = (url.searchParams.get('filter') || '').trim().toLowerCase();
  const since = url.searchParams.get('since');

  const where: any = { websiteId };
  if (since) where.createdAt = { gt: new Date(since) };
  if (filter) {
    where.OR = [
      { eventName: { contains: filter, mode: 'insensitive' } },
      { urlPath: { contains: filter, mode: 'insensitive' } },
    ];
  }

  const db = pulseDb();
  const events = await db.websiteEvent.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      sessionId: true,
      createdAt: true,
      urlPath: true,
      urlQuery: true,
      referrerDomain: true,
      eventType: true,
      eventName: true,
      pageTitle: true,
      hostname: true,
      session: { select: { browser: true, os: true, device: true, country: true } },
      eventData: { select: { dataKey: true, stringValue: true, numberValue: true, dateValue: true } },
    },
  });

  return json({
    events: (events as any[]).map(e => ({
      id: e.id,
      sessionId: e.sessionId,
      createdAt: e.createdAt,
      type: e.eventType === 1 ? 'pageview' : 'custom',
      urlPath: e.urlPath,
      urlQuery: e.urlQuery,
      referrerDomain: e.referrerDomain,
      eventName: e.eventName,
      pageTitle: e.pageTitle,
      hostname: e.hostname,
      browser: e.session?.browser || null,
      os: e.session?.os || null,
      device: e.session?.device || null,
      country: e.session?.country || null,
      data: Object.fromEntries(
        (e.eventData || []).map((d: any) => [
          d.dataKey,
          d.stringValue ?? (d.numberValue != null ? Number(d.numberValue) : d.dateValue),
        ]),
      ),
    })),
  });
}
