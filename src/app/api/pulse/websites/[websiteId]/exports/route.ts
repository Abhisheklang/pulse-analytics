import { z } from 'zod';
import { uuid } from '@/lib/crypto';
import { pulseDb } from '@/lib/pulse/stats';
import { parseRequest } from '@/lib/request';
import { json, unauthorized } from '@/lib/response';
import { canUpdateWebsite, canViewWebsite } from '@/permissions';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ websiteId: string }> },
) {
  const { auth, error } = await parseRequest(request);
  if (error) return error();

  const { websiteId } = await params;
  if (!(await canViewWebsite(auth, websiteId))) return unauthorized();

  const db = pulseDb();
  const [jobs, logs] = await Promise.all([
    db.pulseExportJob.findMany({ where: { websiteId }, orderBy: { createdAt: 'desc' } }),
    db.pulseExportLog.findMany({
      where: { websiteId },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
  ]);

  return json({ jobs, logs });
}

const createSchema = z.object({
  name: z.string().min(1).max(100),
  destination: z.enum(['s3', 'bigquery']),
  format: z.enum(['ndjson', 'csv']).default('ndjson'),
  config: z.object({}).passthrough(),
  enabled: z.boolean().default(true),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ websiteId: string }> },
) {
  const { auth, body, error } = await parseRequest(request, createSchema);
  if (error) return error();

  const { websiteId } = await params;
  if (!(await canUpdateWebsite(auth, websiteId))) return unauthorized();

  const job = await pulseDb().pulseExportJob.create({
    data: {
      id: uuid(),
      websiteId,
      name: body.name,
      destination: body.destination,
      format: body.format,
      config: body.config,
      enabled: body.enabled,
    },
  });

  return json({ job });
}
