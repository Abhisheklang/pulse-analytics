import { z } from 'zod';
import { uuid } from '@/lib/crypto';
import { pulseDb } from '@/lib/pulse/stats';
import { parseRequest } from '@/lib/request';
import { badRequest, json, unauthorized } from '@/lib/response';
import { canUpdateWebsite, canViewWebsite } from '@/permissions';

const createSchema = z.object({
  name: z.string().min(1).max(100),
  metric: z.enum(['pageviews', 'visitors']).default('pageviews'),
  condition: z.enum(['spike', 'drop', 'above', 'below', 'nodata']),
  threshold: z.coerce.number().default(0),
  windowHours: z.coerce.number().int().min(1).max(168).default(24),
  webhookUrl: z.string().url().max(1000).optional().nullable(),
  channel: z.enum(['webhook', 'slack', 'discord', 'telegram', 'email']).default('webhook'),
  telegramBotToken: z.string().max(200).optional().nullable(),
  telegramChatId: z.string().max(100).optional().nullable(),
  emailTo: z.string().max(320).optional().nullable(),
  enabled: z.boolean().default(true),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ websiteId: string }> },
) {
  const { auth, error } = await parseRequest(request);
  if (error) return error();

  const { websiteId } = await params;
  if (!(await canViewWebsite(auth, websiteId))) return unauthorized();

  const db = pulseDb();
  const [rules, logs] = await Promise.all([
    db.pulseAlertRule.findMany({ where: { websiteId }, orderBy: { createdAt: 'desc' } }),
    db.pulseAlertLog.findMany({
      where: { websiteId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
  ]);

  return json({ rules, logs });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ websiteId: string }> },
) {
  const { auth, body, error } = await parseRequest(request, createSchema);
  if (error) return error();

  const { websiteId } = await params;
  if (!(await canUpdateWebsite(auth, websiteId))) return unauthorized();

  if (body.channel === 'telegram') {
    if (!body.telegramBotToken || !body.telegramChatId) {
      return badRequest({ message: 'Telegram rules need a bot token and a chat ID.' });
    }
  } else if (body.channel === 'email') {
    if (!body.emailTo) {
      return badRequest({ message: 'Email rules need a recipient address.' });
    }
  } else if (!body.webhookUrl) {
    return badRequest({ message: 'A webhook URL is required for this channel.' });
  }

  const rule = await pulseDb().pulseAlertRule.create({
    data: {
      id: uuid(),
      websiteId,
      name: body.name,
      metric: body.metric,
      condition: body.condition,
      threshold: body.threshold,
      windowHours: body.windowHours,
      webhookUrl: body.webhookUrl || '',
      channel: body.channel,
      telegramBotToken: body.telegramBotToken || null,
      telegramChatId: body.telegramChatId || null,
      emailTo: body.emailTo || null,
      enabled: body.enabled,
    },
  });

  return json(rule);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ websiteId: string }> },
) {
  const { auth, body, error } = await parseRequest(
    request,
    z.object({ id: z.string().uuid(), enabled: z.boolean() }),
  );
  if (error) return error();

  const { websiteId } = await params;
  if (!(await canUpdateWebsite(auth, websiteId))) return unauthorized();

  const existing = await pulseDb().pulseAlertRule.findFirst({
    where: { id: body.id, websiteId },
  });
  if (!existing) return badRequest({ message: 'Rule not found.' });

  const rule = await pulseDb().pulseAlertRule.update({
    where: { id: body.id },
    data: { enabled: body.enabled },
  });

  return json(rule);
}
