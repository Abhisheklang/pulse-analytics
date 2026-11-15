import { isCronAuthorized } from '@/lib/pulse/cron-auth';
import { runAllUptimeChecks } from '@/lib/pulse/uptime';
import { parseRequest } from '@/lib/request';
import { forbidden, json } from '@/lib/response';

export async function POST(request: Request) {
  const { body, error } = await parseRequest(request, undefined, { skipAuth: true });
  if (error) return error();

  if (!isCronAuthorized(request)) return forbidden();

  const results = await runAllUptimeChecks(body?.websiteId);

  return json({
    checked: results.length,
    up: results.filter((r: any) => r.check.up).length,
    down: results.filter((r: any) => !r.check.up).length,
    results,
  });
}
