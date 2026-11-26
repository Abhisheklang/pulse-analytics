import { z } from 'zod';
import { uuid } from '@/lib/crypto';
import { pulseDb } from '@/lib/pulse/stats';
import { parseRequest } from '@/lib/request';
import { json, unauthorized } from '@/lib/response';
import { canUpdateWebsite, canViewWebsite } from '@/permissions';

async function getOrCreateSetting(websiteId: string) {
  const db = pulseDb();
  const existing = await db.pulseSiteSetting.findUnique({ where: { websiteId } });
  if (existing) return existing;

  return db.pulseSiteSetting.create({
    data: { websiteId, retentionDays: 0, badgeEnabled: false, badgeToken: uuid().replace(/-/g, '') },
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ websiteId: string }> },
) {
  const { auth, error } = await parseRequest(request);
  if (error) return error();

  const { websiteId } = await params;
  if (!(await canViewWebsite(auth, websiteId))) return unauthorized();

  const db = pulseDb();
  const setting = await getOrCreateSetting(websiteId);

  // SEC-7 (related): the badge token is a credential for the public
  // badge endpoint; view-level callers do not receive it.
  const canUpdate = await canUpdateWebsite(auth, websiteId);
  const safeSetting = canUpdate ? setting : { ...setting, badgeToken: undefined };

  const [range, eventCount, sessionCount] = await Promise.all([
    db.websiteEvent.aggregate({
      where: { websiteId },
      _min: { createdAt: true },
      _max: { createdAt: true },
    }),
    db.websiteEvent.count({ where: { websiteId } }),
    db.session.count({ where: { websiteId } }),
  ]);

  return json({
    setting: safeSetting,
    dataRange: { from: range._min.createdAt, to: range._max.createdAt },
    eventCount,
    sessionCount,
  });
}

const updateSchema = z.object({
  retentionDays: z.coerce.number().int().min(0).max(3650).optional(),
  badgeEnabled: z.boolean().optional(),
  regenerateBadgeToken: z.boolean().optional(),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ websiteId: string }> },
) {
  const { auth, body, error } = await parseRequest(request, updateSchema);
  if (error) return error();

  const { websiteId } = await params;
  if (!(await canUpdateWebsite(auth, websiteId))) return unauthorized();

  const setting = await getOrCreateSetting(websiteId);

  const updated = await pulseDb().pulseSiteSetting.update({
    where: { websiteId },
    data: {
      ...(body.retentionDays !== undefined ? { retentionDays: body.retentionDays } : {}),
      ...(body.badgeEnabled !== undefined ? { badgeEnabled: body.badgeEnabled } : {}),
      ...(body.regenerateBadgeToken
        ? { badgeToken: uuid().replace(/-/g, '') }
        : {}),
    },
  });

  return json(updated || setting);
}
