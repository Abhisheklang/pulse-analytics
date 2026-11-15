import { pulseDb } from '@/lib/pulse/stats';
import { parseRequest } from '@/lib/request';
import { json, unauthorized } from '@/lib/response';

// Admin audit log: newest-first list of recorded operator actions, with an
// optional filter by action type. Admins only.
export async function GET(request: Request) {
  const { auth, error } = await parseRequest(request);
  if (error) return error();

  const user: any = (auth as any).user;
  if (!user?.isAdmin) return unauthorized();

  const url = new URL(request.url);
  const action = url.searchParams.get('action');
  const limit = Math.min(500, Math.max(1, Number(url.searchParams.get('limit')) || 100));

  const logs = await pulseDb().pulseAuditLog.findMany({
    where: action ? { action } : {},
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  const websiteIds = [...new Set((logs as any[]).map(l => l.websiteId).filter(Boolean))];
  const websites = websiteIds.length
    ? await pulseDb().website.findMany({
        where: { id: { in: websiteIds } },
        select: { id: true, name: true },
      })
    : [];
  const names = new Map((websites as any[]).map(w => [w.id, w.name]));

  return json({
    logs: (logs as any[]).map(l => ({ ...l, websiteName: names.get(l.websiteId) || null })),
  });
}
