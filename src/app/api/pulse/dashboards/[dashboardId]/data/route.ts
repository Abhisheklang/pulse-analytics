import { computeDashboardData, type DashboardWidget } from '@/lib/pulse/dashboards';
import { pulseDb } from '@/lib/pulse/stats';
import { parseRequest } from '@/lib/request';
import { json, notFound } from '@/lib/response';
import { canViewWebsite } from '@/permissions';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ dashboardId: string }> },
) {
  const { auth, error } = await parseRequest(request);
  if (error) return error();

  const { dashboardId } = await params;
  const user: any = (auth as any).user;
  const dashboard = await pulseDb().pulseDashboard.findFirst({
    where: { id: dashboardId, userId: user.id },
  });
  if (!dashboard) return notFound();

  const layout = (dashboard.layout || []) as unknown as DashboardWidget[];

  // Only compute widgets for websites this user may actually view.
  const websiteIds = [...new Set(layout.map(w => w.websiteId))];
  const allowed = new Set<string>();
  for (const id of websiteIds) {
    if (await canViewWebsite(auth, id)) allowed.add(id);
  }

  const values = await computeDashboardData(layout.filter(w => allowed.has(w.websiteId)));
  for (const w of layout) {
    if (!allowed.has(w.websiteId)) values[w.id] = { error: 'No access to this website.' };
  }

  return json({ dashboardId, values });
}
