// Masking for integration secrets stored on Pulse config rows.
//
// Config-bearing GET endpoints require update-level access, and even then
// the stored secrets are never returned in full: responses carry this mask
// instead, following the SMTP password pattern in settings.ts. Write
// handlers treat an incoming mask value as "keep the stored secret", so
// edit forms prefilled from a masked GET do not overwrite the real value.

export const PULSE_SECRET_MASK = '********';

export function isMaskedSecret(value: unknown): boolean {
  return value === PULSE_SECRET_MASK;
}

function maskValue(value: unknown): unknown {
  return value ? PULSE_SECRET_MASK : value;
}

// PulseExportJob.config holds S3 secretAccessKey / BigQuery privateKey.
export function maskExportJob(job: any) {
  if (!job || typeof job !== 'object') return job;
  const config = job.config;
  if (!config || typeof config !== 'object') return job;
  const masked = { ...config };
  if (masked.secretAccessKey) masked.secretAccessKey = PULSE_SECRET_MASK;
  if (masked.privateKey) masked.privateKey = PULSE_SECRET_MASK;
  return { ...job, config: masked };
}

// Alert rules and report schedules hold a Telegram bot token.
export function maskTelegramToken(row: any) {
  if (!row || typeof row !== 'object' || !row.telegramBotToken) return row;
  return { ...row, telegramBotToken: maskValue(row.telegramBotToken) };
}

// PulseWebhookConfig.secret is the event-forwarding signing secret.
export function maskWebhookConfig(config: any) {
  if (!config || typeof config !== 'object' || !config.secret) return config;
  return { ...config, secret: PULSE_SECRET_MASK };
}

// Uptime monitors hold a credential-bearing notification webhook URL.
export function maskUptimeMonitor(monitor: any) {
  if (!monitor || typeof monitor !== 'object' || !monitor.notifyWebhookUrl) return monitor;
  return { ...monitor, notifyWebhookUrl: PULSE_SECRET_MASK };
}
