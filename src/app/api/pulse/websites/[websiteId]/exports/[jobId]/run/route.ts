import { runExportJob } from '@/lib/pulse/exporter';
import { pulseDb } from '@/lib/pulse/stats';
import { parseRequest } from '@/lib/request';
import { json, notFound, unauthorized } from '@/lib/response';
import { canUpdateWebsite } from '@/permissions';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ websiteId: string; jobId: string }> },
) {
  const { auth, error } = await parseRequest(request);
  if (error) return error();

  const { websiteId, jobId } = await params;
  if (!(await canUpdateWebsite(auth, websiteId))) return unauthorized();

  const job = await pulseDb().pulseExportJob.findFirst({ where: { id: jobId, websiteId } });
  if (!job) return notFound();

  const url = new URL(request.url);
  const days = Math.min(3650, Math.max(1, Number(url.searchParams.get('days')) || 30));

  const result = await runExportJob(job, auth, days);

  return json(result);
}
