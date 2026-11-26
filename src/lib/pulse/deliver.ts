// Multi-channel delivery for Pulse alerts and scheduled reports.
// Channels: generic webhook, Slack (incoming webhook), Discord (webhook),
// Telegram (Bot API), Email (SMTP, configured under Admin → Settings).
// Telegram's API base is configurable via
// PULSE_TELEGRAM_API_BASE so delivery can be tested against a mock server.

import { getSmtpSettings } from './settings';
import { renderEmailHtml, sendSmtpMail } from './smtp';
import { checkPublicUrl } from './url-guard';

export interface DeliveryTarget {
  channel?: string | null;
  webhookUrl?: string | null;
  telegramBotToken?: string | null;
  telegramChatId?: string | null;
  emailTo?: string | null;
}

export function parseRecipients(value?: string | null): string[] {
  if (!value) return [];
  return value
    .split(/[,;]/)
    .map(s => s.trim())
    .filter(Boolean);
}

export interface DeliveryMessage {
  title: string;
  text: string;
  fields?: { label: string; value: string }[];
  // Extra machine-readable data, included only in generic webhook payloads.
  extra?: Record<string, any>;
}

export interface DeliveryResult {
  ok: boolean;
  status?: number;
  error?: string;
  channel: string;
}

async function postJson(
  url: string,
  payload: Record<string, any>,
  timeoutMs = 5000,
): Promise<{ ok: boolean; status?: number; error?: string }> {
  // SSRF guard: webhook and bot API URLs are user-supplied.
  const blocked = await checkPublicUrl(url);
  if (blocked) return { ok: false, error: blocked };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timer);
    return { ok: res.ok, status: res.status };
  } catch (e: any) {
    return { ok: false, error: e?.name === 'AbortError' ? 'timeout' : String(e?.message || e) };
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function channelOf(target: DeliveryTarget): string {
  return (target.channel || 'webhook').toLowerCase();
}

export function hasTarget(target: DeliveryTarget): boolean {
  const channel = channelOf(target);
  if (channel === 'telegram') return !!(target.telegramBotToken && target.telegramChatId);
  if (channel === 'email') return parseRecipients(target.emailTo).length > 0;
  return !!target.webhookUrl;
}

// Send a message by email using the admin-configured SMTP settings.
// Used directly for the 'email' channel and for rules/schedules that carry
// an additional email recipient alongside their primary channel.
export async function deliverEmail(
  target: DeliveryTarget,
  message: DeliveryMessage,
): Promise<DeliveryResult> {
  const channel = 'email';
  const recipients = parseRecipients(target.emailTo);
  if (!recipients.length) {
    return { ok: false, error: 'No email recipient configured', channel };
  }

  const settings = await getSmtpSettings();
  if (!settings) {
    return { ok: false, error: 'SMTP is not configured (Admin → Settings → Email)', channel };
  }

  const fieldLines = (message.fields || []).map(f => `${f.label}: ${f.value}`);
  const text = [message.text, ...fieldLines].filter(Boolean).join('\n');

  const result = await sendSmtpMail(settings, {
    to: recipients,
    subject: message.title,
    text,
    html: renderEmailHtml(message.title, text),
  });

  return { ok: result.ok, status: result.code, error: result.error, channel };
}

export async function deliverToChannel(
  target: DeliveryTarget,
  message: DeliveryMessage,
): Promise<DeliveryResult> {
  const channel = channelOf(target);
  const { title, text } = message;
  const fields = message.fields || [];

  if (channel === 'email') {
    return deliverEmail(target, message);
  }

  if (channel === 'telegram') {
    if (!target.telegramBotToken || !target.telegramChatId) {
      return { ok: false, error: 'Telegram bot token or chat id missing', channel };
    }
    const base = (process.env.PULSE_TELEGRAM_API_BASE || 'https://api.telegram.org').replace(
      /\/$/,
      '',
    );
    const lines = [`<b>${escapeHtml(title)}</b>`, escapeHtml(text)];
    for (const f of fields) {
      lines.push(`<b>${escapeHtml(f.label)}:</b> ${escapeHtml(f.value)}`);
    }
    const res = await postJson(`${base}/bot${target.telegramBotToken}/sendMessage`, {
      chat_id: target.telegramChatId,
      text: lines.join('\n'),
      parse_mode: 'HTML',
    });
    return { ...res, channel };
  }

  if (!target.webhookUrl) {
    return { ok: false, error: 'Webhook URL missing', channel };
  }

  if (channel === 'slack') {
    const blocks: any[] = [
      { type: 'header', text: { type: 'plain_text', text: title.slice(0, 150) } },
      { type: 'section', text: { type: 'mrkdwn', text } },
    ];
    if (fields.length) {
      blocks.push({
        type: 'section',
        fields: fields
          .slice(0, 10)
          .map(f => ({ type: 'mrkdwn', text: `*${f.label}*\n${f.value}` })),
      });
    }
    blocks.push({
      type: 'context',
      elements: [{ type: 'mrkdwn', text: 'Pulse Analytics' }],
    });
    const res = await postJson(target.webhookUrl, { text: `${title}: ${text}`, blocks });
    return { ...res, channel };
  }

  if (channel === 'discord') {
    const res = await postJson(target.webhookUrl, {
      content: title,
      embeds: [
        {
          title,
          description: text,
          color: 0x4f46e5,
          fields: fields
            .slice(0, 25)
            .map(f => ({ name: f.label, value: f.value, inline: true })),
          footer: { text: 'Pulse Analytics' },
        },
      ],
    });
    return { ...res, channel };
  }

  // Generic webhook (wave-1 compatible payload)
  const res = await postJson(target.webhookUrl, {
    source: 'pulse',
    title,
    text,
    fields,
    ...(message.extra || {}),
  });
  return { ...res, channel };
}
