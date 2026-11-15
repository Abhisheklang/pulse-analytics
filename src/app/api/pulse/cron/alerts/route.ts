import { isCronAuthorized } from '@/lib/pulse/cron-auth';
import { evaluateAllAlerts } from '@/lib/pulse/engine';
import { parseRequest } from '@/lib/request';
import { forbidden, json } from '@/lib/response';

export async function POST(request: Request) {
  const { body, error } = await parseRequest(request, undefined, { skipAuth: true });
  if (error) return error();

  if (!isCronAuthorized(request)) return forbidden();

  const results = await evaluateAllAlerts(body?.websiteId);

  return json({
    evaluated: results.length,
    fired: results.filter((r: any) => r.fired).length,
    logs: results,
  });
}
