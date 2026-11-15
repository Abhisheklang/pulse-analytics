import { isCronAuthorized } from '@/lib/pulse/cron-auth';
import { sendDueReports } from '@/lib/pulse/engine';
import { parseRequest } from '@/lib/request';
import { forbidden, json } from '@/lib/response';

export async function POST(request: Request) {
  const { error } = await parseRequest(request, undefined, { skipAuth: true });
  if (error) return error();

  if (!isCronAuthorized(request)) return forbidden();

  const results = await sendDueReports();

  return json({ sent: results.length, logs: results });
}
