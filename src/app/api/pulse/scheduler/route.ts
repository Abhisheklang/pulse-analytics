import { z } from 'zod';
import {
  SCHEDULER_JOBS,
  getSchedulerStatus,
  runSchedulerJobNow,
  type SchedulerJob,
} from '@/lib/pulse/scheduler';
import { pulseDb } from '@/lib/pulse/stats';
import { parseRequest } from '@/lib/request';
import { badRequest, json, unauthorized } from '@/lib/response';

// Admin scheduler console API: status (config, per-job last/next run,
// history), config updates, and manual "run now" per job.

const CONFIG_ID = 'global';

const configSchema = z.object({
  enabled: z.boolean(),
  alertsIntervalMinutes: z.coerce.number().int().min(1).max(1440),
  reportsIntervalMinutes: z.coerce.number().int().min(1).max(1440),
  retentionIntervalHours: z.coerce.number().int().min(1).max(720),
});

const runSchema = z.object({
  job: z.enum(SCHEDULER_JOBS),
});

function isAdmin(auth: any) {
  return !!auth?.user?.isAdmin;
}

export async function GET(request: Request) {
  const { auth, error } = await parseRequest(request);
  if (error) return error();
  if (!isAdmin(auth)) return unauthorized();

  return json(await getSchedulerStatus());
}

export async function PUT(request: Request) {
  const { auth, body, error } = await parseRequest(request, configSchema);
  if (error) return error();
  if (!isAdmin(auth)) return unauthorized();

  await pulseDb().pulseSchedulerConfig.upsert({
    where: { id: CONFIG_ID },
    create: { id: CONFIG_ID, ...body },
    update: body,
  });

  return json(await getSchedulerStatus());
}

export async function POST(request: Request) {
  const { auth, body, error } = await parseRequest(request, runSchema);
  if (error) return error();
  if (!isAdmin(auth)) return unauthorized();

  if (!SCHEDULER_JOBS.includes(body.job as SchedulerJob)) {
    return badRequest({ message: 'Unknown job.' });
  }

  const result = await runSchedulerJobNow(body.job as SchedulerJob);
  return json({ result, status: await getSchedulerStatus() });
}
