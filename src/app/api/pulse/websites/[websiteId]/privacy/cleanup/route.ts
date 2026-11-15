import { logAudit } from '@/lib/pulse/audit';
import { runRetentionCleanup } from '@/lib/pulse/retention';
import { pulseDb } from '@/lib/pulse/stats';
import { parseRequest } from '@/lib/request';
import { badRequest, json, unauthorized } from '@/lib/response';
import { canUpdateWebsite } from '@/permissions';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ websiteId: string }> },
) {
  const { auth, error } = await parseRequest(request);
  if (error) return error();

  const { websiteId } = await params;
  if (!(await canUpdateWebsite(auth, websiteId))) return unauthorized();

  const db = pulseDb();
  const setting = await db.pulseSiteSetting.findUnique({ where: { websiteId } });

  if (!setting || !setting.retentionDays || setting.retentionDays <= 0) {
    return badRequest({ message: 'Retention is disabled (retentionDays = 0). Set a retention period first.' });
  }

  const result = await runRetentionCleanup(websiteId);

  await logAudit(auth, 'retention_cleanup', websiteId, {
    cutoff: result.cutoff,
    retentionDays: result.retentionDays,
    eventsDeleted: result.eventsDeleted,
    eventDataDeleted: result.eventDataDeleted,
    sessionsDeleted: result.sessionsDeleted,
  });

  return json({
    cutoff: result.cutoff,
    retentionDays: result.retentionDays,
    eventsDeleted: result.eventsDeleted,
    eventDataDeleted: result.eventDataDeleted,
    sessionsDeleted: result.sessionsDeleted,
  });
}
