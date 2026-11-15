import { z } from 'zod';
import { logAudit } from '@/lib/pulse/audit';
import { importCsv } from '@/lib/pulse/importer';
import { pulseDb } from '@/lib/pulse/stats';
import { parseRequest } from '@/lib/request';
import { json, unauthorized } from '@/lib/response';
import { canUpdateWebsite, canViewWebsite } from '@/permissions';

const importSchema = z.object({
  source: z.enum(['ga4', 'plausible', 'matomo', 'generic']),
  csv: z.string().min(1).max(5_000_000),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ websiteId: string }> },
) {
  const { auth, error } = await parseRequest(request);
  if (error) return error();

  const { websiteId } = await params;
  if (!(await canViewWebsite(auth, websiteId))) return unauthorized();

  const logs = await pulseDb().pulseImportLog.findMany({
    where: { websiteId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  return json({ logs });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ websiteId: string }> },
) {
  const { auth, body, error } = await parseRequest(request, importSchema);
  if (error) return error();

  const { websiteId } = await params;
  if (!(await canUpdateWebsite(auth, websiteId))) return unauthorized();

  const result = await importCsv(websiteId, body.source, body.csv);

  await logAudit(auth, 'csv_import', websiteId, {
    source: body.source,
    rowsImported: (result as any)?.rowsImported ?? null,
    rowsSkipped: (result as any)?.rowsSkipped ?? null,
  });

  return json(result);
}
