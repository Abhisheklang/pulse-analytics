import { z } from 'zod';
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

  const db = pulseDb();
  const [config, deliveries] = await Promise.all([
    db.pulseWebhookConfig.findUnique({ where: { websiteId } }),
    db.pulseWebhookDelivery.findMany({
      where: { websiteId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
  ]);

  return json({ config, deliveries });
}

const putSchema = z.object({
  url: z.string().url().max(1000),
  events: z.enum(['all', 'pageview', 'custom']).default('all'),
  secret: z.string().max(200).optional().nullable(),
  enabled: z.boolean().default(true),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ websiteId: string }> },
) {
  const { auth, body, error } = await parseRequest(request, putSchema);
  if (error) return error();

  const { websiteId } = await params;
  if (!(await canUpdateWebsite(auth, websiteId))) return unauthorized();

  const config = await pulseDb().pulseWebhookConfig.upsert({
    where: { websiteId },
    create: {
      websiteId,
      url: body.url,
      events: body.events,
      secret: body.secret || null,
      enabled: body.enabled,
    },
    update: {
      url: body.url,
      events: body.events,
      secret: body.secret || null,
      enabled: body.enabled,
    },
  });

  return json(config);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ websiteId: string }> },
) {
  const { auth, error } = await parseRequest(request);
  if (error) return error();

  const { websiteId } = await params;
  if (!(await canUpdateWebsite(auth, websiteId))) return unauthorized();

  await pulseDb().pulseWebhookConfig.deleteMany({ where: { websiteId } });

  return json({ deleted: true });
}
