import { getWebVitals } from '@/lib/pulse/vitals';
import { parseRequest } from '@/lib/request';
import { json, unauthorized } from '@/lib/response';
import { canViewWebsite } from '@/permissions';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ websiteId: string }> },
) {
  const { auth, error } = await parseRequest(request);
  if (error) return error();

  const { websiteId } = await params;
  if (!(await canViewWebsite(auth, websiteId))) return unauthorized();

  const url = new URL(request.url);
  const days = Math.min(365, Math.max(1, Number(url.searchParams.get('days')) || 30));
  const endAt = new Date();
  const startAt = new Date(endAt.getTime() - days * 86400_000);

  const result = await getWebVitals(websiteId, startAt, endAt);

  return json({ days, ...result });
}
