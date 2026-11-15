import { z } from 'zod';
import { uuid } from '@/lib/crypto';
import { WIDGET_CATALOG, dashboardLayoutSchema } from '@/lib/pulse/dashboards';
import { pulseDb } from '@/lib/pulse/stats';
import { parseRequest } from '@/lib/request';
import { json } from '@/lib/response';

const createSchema = z.object({
  name: z.string().min(1).max(100),
  layout: dashboardLayoutSchema.optional(),
});

export async function GET(request: Request) {
  const { auth, error } = await parseRequest(request);
  if (error) return error();

  const user: any = (auth as any).user;
  const dashboards = await pulseDb().pulseDashboard.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: 'desc' },
  });

  return json({ dashboards, catalog: WIDGET_CATALOG });
}

export async function POST(request: Request) {
  const { auth, body, error } = await parseRequest(request, createSchema);
  if (error) return error();

  const user: any = (auth as any).user;
  const dashboard = await pulseDb().pulseDashboard.create({
    data: {
      id: uuid(),
      userId: user.id,
      name: body.name,
      layout: body.layout || [],
    },
  });

  return json({ dashboard });
}
