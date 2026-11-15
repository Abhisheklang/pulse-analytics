import { z } from 'zod';
import { dashboardLayoutSchema } from '@/lib/pulse/dashboards';
import { pulseDb } from '@/lib/pulse/stats';
import { parseRequest } from '@/lib/request';
import { json, notFound } from '@/lib/response';

async function loadOwned(auth: any, dashboardId: string) {
  const user: any = (auth as any).user;
  return pulseDb().pulseDashboard.findFirst({ where: { id: dashboardId, userId: user.id } });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ dashboardId: string }> },
) {
  const { auth, error } = await parseRequest(request);
  if (error) return error();

  const { dashboardId } = await params;
  const dashboard = await loadOwned(auth, dashboardId);
  if (!dashboard) return notFound();

  return json({ dashboard });
}

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  layout: dashboardLayoutSchema.optional(),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ dashboardId: string }> },
) {
  const { auth, body, error } = await parseRequest(request, updateSchema);
  if (error) return error();

  const { dashboardId } = await params;
  const dashboard = await loadOwned(auth, dashboardId);
  if (!dashboard) return notFound();

  const updated = await pulseDb().pulseDashboard.update({
    where: { id: dashboardId },
    data: {
      ...(body.name ? { name: body.name } : {}),
      ...(body.layout ? { layout: body.layout } : {}),
    },
  });

  return json({ dashboard: updated });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ dashboardId: string }> },
) {
  const { auth, error } = await parseRequest(request);
  if (error) return error();

  const { dashboardId } = await params;
  const dashboard = await loadOwned(auth, dashboardId);
  if (!dashboard) return notFound();

  await pulseDb().pulseDashboard.delete({ where: { id: dashboardId } });

  return json({ deleted: true });
}
