import { logAudit } from '@/lib/pulse/audit';
import { pulseDb } from '@/lib/pulse/stats';
import { parseRequest } from '@/lib/request';
import { badRequest, json, unauthorized } from '@/lib/response';
import { canUpdateWebsite, canViewWebsite } from '@/permissions';

async function loadVisitor(websiteId: string, sessionId: string) {
  const db = pulseDb();

  const session = await db.session.findFirst({ where: { id: sessionId, websiteId } });
  if (!session) return null;

  const [events, sessionData] = await Promise.all([
    db.websiteEvent.findMany({
      where: { websiteId, sessionId },
      orderBy: { createdAt: 'asc' },
      include: {
        eventData: {
          select: { dataKey: true, stringValue: true, numberValue: true, dateValue: true },
        },
      },
    }),
    db.sessionData.findMany({ where: { websiteId, sessionId } }),
  ]);

  return { session, events, sessionData };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ websiteId: string }> },
) {
  const { auth, error } = await parseRequest(request);
  if (error) return error();

  const { websiteId } = await params;
  if (!(await canViewWebsite(auth, websiteId))) return unauthorized();

  const url = new URL(request.url);

  // SEC-7: the downloadable per-visitor export is the same underlying
  // data the C2 fix moved to update level for the bulk export, so the
  // ?export=1 form requires update access too. The in-page lookup
  // stays view-level.
  if (url.searchParams.get('export') === '1' && !(await canUpdateWebsite(auth, websiteId))) {
    return unauthorized();
  }

  const sessionId = url.searchParams.get('sessionId');
  if (!sessionId) return badRequest({ message: 'sessionId is required.' });

  const visitor = await loadVisitor(websiteId, sessionId);
  if (!visitor) return json({ found: false, sessionId });

  const body = {
    found: true,
    session: visitor.session,
    sessionData: visitor.sessionData,
    events: visitor.events.map((e: any) => ({
      ...e,
      data: Object.fromEntries(
        e.eventData.map((d: any) => [
          d.dataKey,
          d.stringValue ?? (d.numberValue != null ? Number(d.numberValue) : d.dateValue),
        ]),
      ),
      eventData: undefined,
    })),
  };

  if (url.searchParams.get('export') === '1') {
    return new Response(JSON.stringify(body, null, 2), {
      headers: {
        'content-type': 'application/json',
        'content-disposition': `attachment; filename="pulse-visitor-${sessionId}.json"`,
      },
    });
  }

  return json(body);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ websiteId: string }> },
) {
  const { auth, error } = await parseRequest(request);
  if (error) return error();

  const { websiteId } = await params;
  if (!(await canUpdateWebsite(auth, websiteId))) return unauthorized();

  const url = new URL(request.url);
  const sessionId = url.searchParams.get('sessionId');
  if (!sessionId) return badRequest({ message: 'sessionId is required.' });

  const db = pulseDb();
  const session = await db.session.findFirst({ where: { id: sessionId, websiteId } });
  if (!session) return badRequest({ message: 'Visitor session not found for this website.' });

  const events = await db.websiteEvent.findMany({
    where: { websiteId, sessionId },
    select: { id: true },
  });
  const eventIds = events.map((e: any) => e.id);

  let eventDataDeleted = 0;
  if (eventIds.length) {
    const res = await db.eventData.deleteMany({ where: { websiteEventId: { in: eventIds } } });
    eventDataDeleted = res.count;
    await db.revenue.deleteMany({ where: { eventId: { in: eventIds } } });
  }

  const eventsDeleted = await db.websiteEvent.deleteMany({ where: { websiteId, sessionId } });
  const sessionDataDeleted = await db.sessionData.deleteMany({ where: { websiteId, sessionId } });
  await db.sessionLink.deleteMany({ where: { websiteId, sessionId } });
  await db.revenue.deleteMany({ where: { websiteId, sessionId } });
  const sessionDeleted = await db.session.deleteMany({ where: { id: sessionId, websiteId } });

  await logAudit(auth, 'visitor_delete', websiteId, {
    sessionId,
    eventsDeleted: eventsDeleted.count,
    eventDataDeleted,
    sessionsDeleted: sessionDeleted.count,
  });

  return json({
    deleted: true,
    sessionId,
    eventsDeleted: eventsDeleted.count,
    eventDataDeleted,
    sessionDataDeleted: sessionDataDeleted.count,
    sessionsDeleted: sessionDeleted.count,
  });
}
