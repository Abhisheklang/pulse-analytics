import { z } from 'zod';
import {
  PULSE_SETTINGS_ID,
  SMTP_PASSWORD_MASK,
  publicSmtpView,
} from '@/lib/pulse/settings';
import { pulseDb } from '@/lib/pulse/stats';
import { parseRequest } from '@/lib/request';
import { json, unauthorized } from '@/lib/response';

// Admin email (SMTP) settings. The stored password is never returned:
// GET answers with a mask placeholder plus a hasPassword flag, and PUT
// treats the mask (or an empty value) as "keep the existing password".

const updateSchema = z.object({
  host: z.string().max(255).optional().nullable(),
  port: z.coerce.number().int().min(1).max(65535).optional().nullable(),
  secure: z.boolean().default(false),
  username: z.string().max(255).optional().nullable(),
  password: z.string().max(500).optional().nullable(),
  fromName: z.string().max(100).optional().nullable(),
  fromEmail: z.string().max(320).optional().nullable(),
});

function isAdmin(auth: any) {
  return !!auth?.user?.isAdmin;
}

export async function GET(request: Request) {
  const { auth, error } = await parseRequest(request);
  if (error) return error();
  if (!isAdmin(auth)) return unauthorized();

  const row = await pulseDb().pulseSettings.findUnique({ where: { id: PULSE_SETTINGS_ID } });
  return json({ smtp: publicSmtpView(row) });
}

export async function PUT(request: Request) {
  const { auth, body, error } = await parseRequest(request, updateSchema);
  if (error) return error();
  if (!isAdmin(auth)) return unauthorized();

  const db = pulseDb();
  const existing = await db.pulseSettings.findUnique({ where: { id: PULSE_SETTINGS_ID } });

  const keepPassword =
    !body.password || body.password === SMTP_PASSWORD_MASK ? existing?.smtpPassword || null : body.password;

  const data = {
    smtpHost: body.host || null,
    smtpPort: body.port || null,
    smtpSecure: body.secure,
    smtpUser: body.username || null,
    smtpPassword: keepPassword,
    smtpFromName: body.fromName || null,
    smtpFromEmail: body.fromEmail || null,
  };

  const row = await db.pulseSettings.upsert({
    where: { id: PULSE_SETTINGS_ID },
    create: { id: PULSE_SETTINGS_ID, ...data },
    update: data,
  });

  return json({ smtp: publicSmtpView(row) });
}
