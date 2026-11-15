import { sendReportSchedule } from '@/lib/pulse/engine';
import { pulseDb } from '@/lib/pulse/stats';
import { parseRequest } from '@/lib/request';
import { badRequest, json, unauthorized } from '@/lib/response';
import { canUpdateWebsite } from '@/permissions';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ websiteId: string; scheduleId: string }> },
) {
  const { auth, error } = await parseRequest(request);
  if (error) return error();

  const { websiteId, scheduleId } = await params;
  if (!(await canUpdateWebsite(auth, websiteId))) return unauthorized();

  const schedule = await pulseDb().pulseReportSchedule.findFirst({
    where: { id: scheduleId, websiteId },
  });

  if (!schedule) return badRequest({ message: 'Schedule not found.' });

  const log = await sendReportSchedule(schedule);

  return json(log);
}
