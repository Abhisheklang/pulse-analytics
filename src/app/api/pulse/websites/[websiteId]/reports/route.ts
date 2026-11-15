import { z } from 'zod';
import { uuid } from '@/lib/crypto';
import { pulseDb } from '@/lib/pulse/stats';
import { parseRequest } from '@/lib/request';
import { json, unauthorized } from '@/lib/response';
import { canUpdateWebsite, canViewWebsite } from '@/permissions';

const createSchema = z.object({
  name: z.string().min(1).max(100),
  frequency: z.enum(['daily', 'weekly']).default('weekly'),
  webhookUrl: z.string().url().max(1000).optional().nullable(),
  channel: z.enum(['webhook', 'slack', 'discord', 'telegram', 'email']).default('webhook'),
  telegramBotToken: z.string().max(200).optional().nullable(),
  telegramChatId: z.string().max(100).optional().nullable(),
  email: z.string().email().max(320).optional().nullable(),
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
  const [schedules, logs] = await Promise.all([
    db.pulseReportSchedule.findMany({ where: { websiteId }, orderBy: { createdAt: 'desc' } }),
    db.pulseReportLog.findMany({ where: { websiteId }, orderBy: { createdAt: 'desc' }, take: 20 }),
  ]);

  return json({ schedules, logs });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ websiteId: string }> },
) {
  const { auth, body, error } = await parseRequest(request, createSchema);
  if (error) return error();

  const { websiteId } = await params;
  if (!(await canUpdateWebsite(auth, websiteId))) return unauthorized();

  const schedule = await pulseDb().pulseReportSchedule.create({
    data: {
      id: uuid(),
      websiteId,
      name: body.name,
      frequency: body.frequency,
      webhookUrl: body.webhookUrl || null,
      channel: body.channel,
      telegramBotToken: body.telegramBotToken || null,
      telegramChatId: body.telegramChatId || null,
      email: body.email || null,
      enabled: body.enabled,
    },
  });

  return json(schedule);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ websiteId: string }> },
) {
  const { auth, body, error } = await parseRequest(
    request,
    z.object({ id: z.string().uuid() }),
  );
  if (error) return error();

  const { websiteId } = await params;
  if (!(await canUpdateWebsite(auth, websiteId))) return unauthorized();

  await pulseDb().pulseReportLog.deleteMany({ where: { scheduleId: body.id } });
  await pulseDb().pulseReportSchedule.deleteMany({ where: { id: body.id, websiteId } });

  return json({ deleted: true });
}
