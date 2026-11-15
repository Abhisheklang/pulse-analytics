import { pulseDb } from './stats';
import type { SmtpSettings } from './smtp';

// Global Pulse settings stored in the pulse_settings table (single row,
// id 'global'). Currently holds the admin-managed SMTP configuration.
// The stored password is server-side only: API routes must mask it.

export const PULSE_SETTINGS_ID = 'global';
export const SMTP_PASSWORD_MASK = '********';

export async function getPulseSettingsRow() {
  return pulseDb().pulseSettings.findUnique({ where: { id: PULSE_SETTINGS_ID } });
}

export async function getSmtpSettings(): Promise<SmtpSettings | null> {
  const row = await getPulseSettingsRow();
  if (!row?.smtpHost) return null;
  return {
    host: row.smtpHost,
    port: row.smtpPort || (row.smtpSecure ? 465 : 587),
    secure: row.smtpSecure,
    username: row.smtpUser,
    password: row.smtpPassword,
    fromName: row.smtpFromName,
    fromEmail: row.smtpFromEmail,
  };
}

// Public view of the settings: everything except the password itself.
export function publicSmtpView(row: any) {
  return {
    host: row?.smtpHost || '',
    port: row?.smtpPort || '',
    secure: !!row?.smtpSecure,
    username: row?.smtpUser || '',
    hasPassword: !!row?.smtpPassword,
    password: row?.smtpPassword ? SMTP_PASSWORD_MASK : '',
    fromName: row?.smtpFromName || '',
    fromEmail: row?.smtpFromEmail || '',
    configured: !!row?.smtpHost,
  };
}
