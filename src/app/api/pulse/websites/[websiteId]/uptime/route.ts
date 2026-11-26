import { z } from 'zod';
import { uuid } from '@/lib/crypto';
import { isMaskedSecret, maskUptimeMonitor } from '@/lib/pulse/secrets';
import { pulseDb } from '@/lib/pulse/stats';
import { getUptimeSummary } from '@/lib/pulse/uptime';
import { parseRequest } from '@/lib/request';
import { json, unauthorized } from '@/lib/response';
import { canUpdateWebsite } from '@/permissions';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ websiteId: string }> },
) {
  const { auth, error } = await parseRequest(request);
  if (error) return error();

  const { websiteId } = await params;
  // The monitor row holds a credential-bearing notify webhook URL:
  // update-level only, never view-level or share-token access, masked below.
  if (!(await canUpdateWebsite(auth, websiteId))) return unauthorized();

  const summary = await getUptimeSummary(websiteId);
  summary.monitor = maskUptimeMonitor(summary.monitor);
  const setting = await pulseDb().pulseSiteSetting.findUnique({ where: { websiteId } });

  return json({
    ...summary,
    statusPage: {
      // The public status page shares the live badge's per-site token.
      enabled: !!(setting?.badgeEnabled && setting?.badgeToken),
      token: setting?.badgeToken || null,
      path: `/status/${websiteId}`,
    },
  });
}

const updateSchema = z.object({
  enabled: z.boolean(),
  url: z.string().url().max(1000),
  intervalMinutes: z.coerce.number().int().min(1).max(1440).default(5),
  notifyWebhookUrl: z.string().url().max(1000).optional().nullable(),
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
  const existing = await db.pulseUptimeMonitor.findUnique({ where: { websiteId } });

  // A masked notify URL in the payload means "keep the stored URL" (the
  // edit form is prefilled from the masked GET response).
  const data = {
    enabled: body.enabled,
    url: body.url,
    intervalMinutes: body.intervalMinutes,
    notifyWebhookUrl: isMaskedSecret(body.notifyWebhookUrl)
      ? existing?.notifyWebhookUrl || null
      : body.notifyWebhookUrl || null,
  };

  const monitor = existing
    ? await db.pulseUptimeMonitor.update({ where: { websiteId }, data })
    : await db.pulseUptimeMonitor.create({ data: { id: uuid(), websiteId, ...data } });

  return json(monitor);
}
