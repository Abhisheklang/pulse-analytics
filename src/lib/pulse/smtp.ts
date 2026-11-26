import { connect as netConnect, type Socket } from 'node:net';
import { connect as tlsConnect, type TLSSocket } from 'node:tls';

// Hand-rolled SMTP client for Pulse email delivery (no external mail
// dependency): EHLO, STARTTLS upgrade, AUTH LOGIN, MAIL/RCPT/DATA with
// dot-stuffing. Settings come from the pulse_settings table (admin-managed).

export interface SmtpSettings {
  host: string;
  port: number;
  secure: boolean; // true = implicit TLS from connect; false = plain + STARTTLS when offered
  username?: string | null;
  password?: string | null;
  fromName?: string | null;
  fromEmail?: string | null;
}

export interface MailMessage {
  to: string[]; // recipient addresses
  subject: string;
  text: string;
  html?: string;
}

export interface SmtpResult {
  ok: boolean;
  code?: number;
  error?: string;
}

const TIMEOUT_MS = 15000;

class SmtpSession {
  private socket: Socket | TLSSocket;
  private buffer = '';
  private waiters: ((text: string) => void)[] = [];

  constructor(socket: Socket | TLSSocket) {
    this.socket = socket;
    this.attach();
  }

  private attach() {
    this.socket.on('data', chunk => {
      this.buffer += chunk.toString('utf8');
      this.pump();
    });
  }

  private pump() {
    // A reply is complete when a line matches /^\d{3} / (space, not dash).
    const match = this.buffer.match(/[\s\S]*?^\d{3} [^\r\n]*\r\n/m);
    if (match && this.waiters.length) {
      const text = match[0];
      this.buffer = this.buffer.slice(text.length);
      const waiter = this.waiters.shift()!;
      waiter(text);
    }
  }

  readReply(): Promise<{ code: number; text: string }> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('SMTP reply timeout')), TIMEOUT_MS);
      this.waiters.push(text => {
        clearTimeout(timer);
        const code = parseInt(text.slice(0, 3), 10);
        resolve({ code, text });
      });
      this.pump();
    });
  }

  async command(line: string, expect: number[]): Promise<{ code: number; text: string }> {
    this.socket.write(`${line}\r\n`);
    const reply = await this.readReply();
    if (!expect.includes(reply.code)) {
      throw new Error(`SMTP ${line.split(' ')[0]} failed: ${reply.text.trim()}`);
    }
    return reply;
  }

  writeRaw(data: string) {
    this.socket.write(data);
  }

  upgradeToTls(host: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('STARTTLS upgrade timeout')), TIMEOUT_MS);
      const secure = tlsConnect({ socket: this.socket, servername: host }, () => {
        clearTimeout(timer);
        this.socket = secure;
        this.attach();
        resolve();
      });
      secure.on('error', err => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  close() {
    try {
      this.socket.end();
      this.socket.destroy();
    } catch {
      // ignore
    }
  }
}

function connectSocket(host: string, port: number, secure: boolean): Promise<Socket | TLSSocket> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('SMTP connect timeout')), TIMEOUT_MS);
    const onError = (err: Error) => {
      clearTimeout(timer);
      reject(err);
    };
    if (secure) {
      const socket = tlsConnect({ host, port, servername: host }, () => {
        clearTimeout(timer);
        resolve(socket);
      });
      socket.once('error', onError);
    } else {
      const socket = netConnect({ host, port }, () => {
        clearTimeout(timer);
        resolve(socket);
      });
      socket.once('error', onError);
    }
  });
}

function encodeSubject(subject: string): string {
  // RFC 2047 encoded-word for non-ASCII subjects; plain pass-through otherwise.
  if (/^[\x20-\x7e]*$/.test(subject)) return subject;
  return `=?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`;
}

function buildMime(settings: SmtpSettings, message: MailMessage): string {
  const fromEmail = settings.fromEmail || settings.username || 'pulse@localhost';
  const from = settings.fromName ? `"${settings.fromName}" <${fromEmail}>` : fromEmail;
  const boundary = `pulse-boundary-${Date.now().toString(36)}`;
  const headers = [
    `From: ${from}`,
    `To: ${message.to.join(', ')}`,
    `Subject: ${encodeSubject(message.subject)}`,
    `Date: ${new Date().toUTCString()}`,
    'MIME-Version: 1.0',
  ];

  if (message.html) {
    headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
    const body = [
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      message.text,
      `--${boundary}`,
      'Content-Type: text/html; charset=utf-8',
      '',
      message.html,
      `--${boundary}--`,
      '',
    ].join('\r\n');
    return headers.join('\r\n') + '\r\n' + body;
  }

  headers.push('Content-Type: text/plain; charset=utf-8');
  return headers.join('\r\n') + '\r\n\r\n' + message.text + '\r\n';
}

function dotStuff(data: string): string {
  return data
    .split('\r\n')
    .map(line => (line.startsWith('.') ? `.${line}` : line))
    .join('\r\n');
}

export async function sendSmtpMail(
  settings: SmtpSettings,
  message: MailMessage,
): Promise<SmtpResult> {
  if (!settings.host) return { ok: false, error: 'SMTP host is not configured.' };
  if (!message.to.length) return { ok: false, error: 'No recipients.' };

  const port = settings.port || (settings.secure ? 465 : 587);
  let session: SmtpSession | null = null;

  try {
    const socket = await connectSocket(settings.host, port, settings.secure);
    session = new SmtpSession(socket);

    const greeting = await session.readReply();
    if (greeting.code !== 220) {
      throw new Error(`SMTP greeting failed: ${greeting.text.trim()}`);
    }

    const ehloName = 'pulse.local';
    let ehlo = await session.command(`EHLO ${ehloName}`, [250]);
    const offersStartTls = /STARTTLS/i.test(ehlo.text);

    // SEC-8: track whether the session is encrypted. Implicit TLS starts
    // encrypted; a plain connection becomes encrypted only through a
    // successful STARTTLS upgrade.
    let encrypted = settings.secure;

    if (!settings.secure && offersStartTls) {
      await session.command('STARTTLS', [220]);
      await session.upgradeToTls(settings.host);
      encrypted = true;
      ehlo = await session.command(`EHLO ${ehloName}`, [250]);
    }

    if (settings.username) {
      // SEC-8: never send AUTH credentials over a plaintext connection
      // when the server did not offer STARTTLS. An admin can opt out
      // explicitly for a trusted local relay via the env setting.
      if (!encrypted && process.env.PULSE_SMTP_ALLOW_PLAINTEXT_AUTH !== '1') {
        throw new Error(
          'SMTP server did not offer STARTTLS; refusing to send credentials over a plaintext connection. Set PULSE_SMTP_ALLOW_PLAINTEXT_AUTH=1 to allow plaintext authentication.',
        );
      }
      await session.command('AUTH LOGIN', [334]);
      await session.command(Buffer.from(settings.username, 'utf8').toString('base64'), [334]);
      await session.command(
        Buffer.from(settings.password || '', 'utf8').toString('base64'),
        [235],
      );
    }

    const fromEmail = settings.fromEmail || settings.username || 'pulse@localhost';
    await session.command(`MAIL FROM:<${fromEmail}>`, [250]);
    for (const rcpt of message.to) {
      await session.command(`RCPT TO:<${rcpt}>`, [250, 251]);
    }
    await session.command('DATA', [354]);
    const mime = buildMime(settings, message);
    session.writeRaw(`${dotStuff(mime)}\r\n.\r\n`);
    const dataReply = await session.readReply();
    if (dataReply.code !== 250) {
      throw new Error(`SMTP DATA failed: ${dataReply.text.trim()}`);
    }
    await session.command('QUIT', [221]).catch(() => undefined);

    return { ok: true, code: dataReply.code };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  } finally {
    session?.close();
  }
}

// ---------- Pulse-branded message templates ----------

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function renderEmailHtml(title: string, text: string): string {
  const paragraphs = text
    .split('\n')
    .filter(line => line.trim().length)
    .map(line => `<p style="margin:0 0 8px;font-size:14px;line-height:1.5;">${escapeHtml(line)}</p>`)
    .join('');
  return [
    '<div style="font-family:Inter,Arial,sans-serif;background:#f4f4f8;padding:24px;">',
    '<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #e2e2ea;">',
    '<div style="background:#4f46e5;color:#ffffff;padding:16px 20px;font-size:16px;font-weight:700;">Pulse Analytics</div>',
    '<div style="padding:20px;">',
    `<h1 style="font-size:17px;margin:0 0 12px;">${escapeHtml(title)}</h1>`,
    paragraphs,
    '</div>',
    '<div style="padding:12px 20px;border-top:1px solid #eeeef4;color:#6d6d80;font-size:12px;">Sent by Pulse Analytics</div>',
    '</div></div>',
  ].join('');
}
