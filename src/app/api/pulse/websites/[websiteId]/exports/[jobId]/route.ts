import { z } from 'zod';
import { pulseDb } from '@/lib/pulse/stats';
import { parseRequest } from '@/lib/request';
import { json, notFound, unauthorized } from '@/lib/response';
import { canUpdateWebsite } from '@/permissions';

async function loadJob(websiteId: string, jobId: string) {
  return pulseDb().pulseExportJob.findFirst({ where: { id: jobId, websiteId } });
}

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  format: z.enum(['ndjson', 'csv']).optional(),
  config: z.object({}).passthrough().optional(),
  enabled: z.boolean().optional(),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ websiteId: string; jobId: string }> },
) {
  const { auth, body, error } = await parseRequest(request, updateSchema);
  if (error) return error();

  const { websiteId, jobId } = await params;
  if (!(await canUpdateWebsite(auth, websiteId))) return unauthorized();

  const job = await loadJob(websiteId, jobId);
  if (!job) return notFound();

  const updated = await pulseDb().pulseExportJob.update({
    where: { id: jobId },
    data: {
      ...(body.name ? { name: body.name } : {}),
      ...(body.format ? { format: body.format } : {}),
      ...(body.config ? { config: body.config } : {}),
      ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
    },
  });

  return json({ job: updated });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ websiteId: string; jobId: string }> },
) {
  const { auth, error } = await parseRequest(request);
  if (error) return error();

  const { websiteId, jobId } = await params;
  if (!(await canUpdateWebsite(auth, websiteId))) return unauthorized();

  const job = await loadJob(websiteId, jobId);
  if (!job) return notFound();

  await pulseDb().pulseExportJob.delete({ where: { id: jobId } });

  return json({ deleted: true });
}
