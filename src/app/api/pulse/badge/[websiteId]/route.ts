import { badgeSvg } from '@/lib/pulse/badge';
import { getPeriodStats, pulseDb } from '@/lib/pulse/stats';
import { parseRequest } from '@/lib/request';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ websiteId: string }> },
) {
  await parseRequest(request, undefined, { skipAuth: true });

  const { websiteId: rawId } = await params;
  const websiteId = rawId.replace(/\.svg$/, '');
  const url = new URL(request.url);
  const token = url.searchParams.get('token');

  const setting = await pulseDb().pulseSiteSetting.findUnique({ where: { websiteId } });

  if (!setting || !setting.badgeEnabled || !setting.badgeToken || token !== setting.badgeToken) {
    return new Response('Badge not found or disabled.', { status: 404 });
  }

  const now = new Date();
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const stats = await getPeriodStats(websiteId, startOfDay, now);

  const svg = badgeSvg('pulse visitors today', `${stats.visitors} · ${stats.pageviews} views`);

  return new Response(svg, {
    headers: {
      'content-type': 'image/svg+xml',
      'cache-control': 'public, max-age=300',
    },
  });
}
