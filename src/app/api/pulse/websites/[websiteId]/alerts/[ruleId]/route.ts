import { parseRequest } from '@/lib/request';
import { json, unauthorized } from '@/lib/response';
import { pulseDb } from '@/lib/pulse/stats';
import { canUpdateWebsite } from '@/permissions';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ websiteId: string; ruleId: string }> },
) {
  const { auth, error } = await parseRequest(request);
  if (error) return error();

  const { websiteId, ruleId } = await params;
  if (!(await canUpdateWebsite(auth, websiteId))) return unauthorized();

  await pulseDb().pulseAlertLog.deleteMany({ where: { ruleId } });
  await pulseDb().pulseAlertRule.deleteMany({ where: { id: ruleId, websiteId } });

  return json({ deleted: true });
}
