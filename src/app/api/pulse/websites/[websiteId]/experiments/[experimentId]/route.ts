import { z } from 'zod';
import { getExperimentResults } from '@/lib/pulse/experiments';
import { pulseDb } from '@/lib/pulse/stats';
import { parseRequest } from '@/lib/request';
import { badRequest, json, notFound, unauthorized } from '@/lib/response';
import { canUpdateWebsite, canViewWebsite } from '@/permissions';

async function loadExperiment(websiteId: string, experimentId: string) {
  return pulseDb().pulseExperiment.findFirst({ where: { id: experimentId, websiteId } });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ websiteId: string; experimentId: string }> },
) {
  const { auth, error } = await parseRequest(request);
  if (error) return error();

  const { websiteId, experimentId } = await params;
  if (!(await canViewWebsite(auth, websiteId))) return unauthorized();

  const experiment = await loadExperiment(websiteId, experimentId);
  if (!experiment) return notFound();

  const url = new URL(request.url);
  const days = Math.min(365, Math.max(1, Number(url.searchParams.get('days')) || 30));
  const endAt = new Date();
  const startAt = new Date(endAt.getTime() - days * 86400_000);

  return json(await getExperimentResults(experiment, startAt, endAt));
}

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  status: z.enum(['draft', 'running', 'paused']).optional(),
  conversionEvent: z.string().min(1).max(100).optional(),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ websiteId: string; experimentId: string }> },
) {
  const { auth, body, error } = await parseRequest(request, updateSchema);
  if (error) return error();

  const { websiteId, experimentId } = await params;
  if (!(await canUpdateWebsite(auth, websiteId))) return unauthorized();

  const experiment = await loadExperiment(websiteId, experimentId);
  if (!experiment) return notFound();

  const updated = await pulseDb().pulseExperiment.update({
    where: { id: experimentId },
    data: {
      ...(body.name ? { name: body.name } : {}),
      ...(body.status ? { status: body.status } : {}),
      ...(body.conversionEvent ? { conversionEvent: body.conversionEvent } : {}),
    },
  });

  return json({ experiment: updated });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ websiteId: string; experimentId: string }> },
) {
  const { auth, error } = await parseRequest(request);
  if (error) return error();

  const { websiteId, experimentId } = await params;
  if (!(await canUpdateWebsite(auth, websiteId))) return unauthorized();

  const experiment = await loadExperiment(websiteId, experimentId);
  if (!experiment) return notFound();

  await pulseDb().pulseExperiment.delete({ where: { id: experimentId } });

  return json({ deleted: true });
}
