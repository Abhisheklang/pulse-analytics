import { z } from 'zod';
import { uuid } from '@/lib/crypto';
import { getRevenueReport } from '@/lib/pulse/revenue';
import { pulseDb } from '@/lib/pulse/stats';
import { parseRequest } from '@/lib/request';
import { json, unauthorized } from '@/lib/response';
import { canUpdateWebsite, canViewWebsite } from '@/permissions';

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

  const report = await getRevenueReport(websiteId, startAt, endAt);

  return json({ days, ...report });
}

const updateSchema = z.object({
  currency: z
    .string()
    .min(3)
    .max(3)
    .transform(s => s.toUpperCase()),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ websiteId: string }> },
) {
  const { auth, body, error } = await parseRequest(request, updateSchema);
  if (error) return error();

  const { websiteId } = await params;
  if (!(await canUpdateWebsite(auth, websiteId))) return unauthorized();

  const db = pulseDb();
  const existing = await db.pulseSiteSetting.findUnique({ where: { websiteId } });

  const setting = existing
    ? await db.pulseSiteSetting.update({
        where: { websiteId },
        data: { revenueCurrency: body.currency },
      })
    : await db.pulseSiteSetting.create({
        data: {
          websiteId,
          retentionDays: 0,
          badgeEnabled: false,
          badgeToken: uuid().replace(/-/g, ''),
          revenueCurrency: body.currency,
        },
      });

  return json(setting);
}
