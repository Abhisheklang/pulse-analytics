import { z } from 'zod';
import { getSmtpSettings } from '@/lib/pulse/settings';
import { renderEmailHtml, sendSmtpMail } from '@/lib/pulse/smtp';
import { parseRequest } from '@/lib/request';
import { badRequest, json, unauthorized } from '@/lib/response';

const bodySchema = z.object({
  to: z.string().email().max(320),
});

// Admin: send a test email through the configured SMTP server so the admin
// can verify the settings before relying on email alerts/reports.
export async function POST(request: Request) {
  const { auth, body, error } = await parseRequest(request, bodySchema);
  if (error) return error();
  if (!auth?.user?.isAdmin) return unauthorized();

  const settings = await getSmtpSettings();
  if (!settings) {
    return badRequest({ message: 'SMTP is not configured yet. Save the settings first.' });
  }

  const text = [
    'This is a test email from Pulse Analytics.',
    `Sent at ${new Date().toISOString()} to verify the SMTP configuration.`,
    'If you received this, email alerts and scheduled reports will work.',
  ].join('\n');

  const result = await sendSmtpMail(settings, {
    to: [body.to],
    subject: 'Pulse Analytics — test email',
    text,
    html: renderEmailHtml('Pulse Analytics — test email', text),
  });

  if (!result.ok) {
    return badRequest({ message: `Test email failed: ${result.error || 'unknown error'}` });
  }

  return json({ sent: true, to: body.to, smtpCode: result.code });
}
