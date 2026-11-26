import { createServer, type Server, type Socket } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { sendSmtpMail } from '@/lib/pulse/smtp';

// Regression tests for SEC-8: the SMTP client must not silently send
// AUTH credentials over a plaintext connection when the server does
// not offer STARTTLS. A minimal scripted SMTP server stands in for the
// real thing; no external network is used.

let server: Server | null = null;
let received: string[] = [];

async function startSmtpServer(): Promise<number> {
  received = [];
  server = createServer((socket: Socket) => {
    socket.write('220 test ESMTP\r\n');
    let buffer = '';
    let inData = false;
    let authStep = 0;
    socket.on('data', chunk => {
      buffer += chunk.toString('utf8');
      let idx = buffer.indexOf('\r\n');
      while (idx >= 0) {
        const line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        idx = buffer.indexOf('\r\n');
        if (inData) {
          if (line === '.') {
            inData = false;
            socket.write('250 OK\r\n');
          }
          continue;
        }
        received.push(line);
        if (line.startsWith('EHLO')) {
          // No STARTTLS capability is advertised.
          socket.write('250-test\r\n250 AUTH LOGIN\r\n');
        } else if (line.startsWith('AUTH LOGIN')) {
          authStep = 1;
          socket.write('334 VXNlcm5hbWU6\r\n');
        } else if (line.startsWith('MAIL FROM')) {
          socket.write('250 OK\r\n');
        } else if (line.startsWith('RCPT TO')) {
          socket.write('250 OK\r\n');
        } else if (line === 'DATA') {
          inData = true;
          socket.write('354 End data with <CR><LF>.<CR><LF>\r\n');
        } else if (line.startsWith('QUIT')) {
          socket.write('221 Bye\r\n');
        } else if (authStep === 1) {
          // Base64 username line.
          authStep = 2;
          socket.write('334 UGFzc3dvcmQ6\r\n');
        } else if (authStep === 2) {
          // Base64 password line.
          authStep = 0;
          socket.write('235 Authentication successful\r\n');
        } else {
          socket.write('250 OK\r\n');
        }
      }
    });
  });
  await new Promise<void>(resolve => server!.listen(0, '127.0.0.1', resolve));
  return (server!.address() as any).port;
}

afterEach(async () => {
  delete process.env.PULSE_SMTP_ALLOW_PLAINTEXT_AUTH;
  await new Promise(resolve => (server ? server.close(resolve) : resolve(undefined)));
  server = null;
});

describe('SEC-8: SMTP plaintext credential guard', () => {
  it('refuses to authenticate when STARTTLS is not offered', async () => {
    const port = await startSmtpServer();
    const result = await sendSmtpMail(
      { host: '127.0.0.1', port, secure: false, username: 'alice', password: 'secret' },
      { to: ['bob@example.com'], subject: 'Hi', text: 'hello' },
    );
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/STARTTLS/);
    expect(received.some(l => l.startsWith('AUTH'))).toBe(false);
  });

  it('sends mail without credentials over plaintext when no username is set', async () => {
    const port = await startSmtpServer();
    const result = await sendSmtpMail(
      { host: '127.0.0.1', port, secure: false },
      { to: ['bob@example.com'], subject: 'Hi', text: 'hello' },
    );
    expect(result.ok).toBe(true);
    expect(received.some(l => l.startsWith('MAIL FROM'))).toBe(true);
  });

  it('allows plaintext auth only with the explicit env opt-out', async () => {
    process.env.PULSE_SMTP_ALLOW_PLAINTEXT_AUTH = '1';
    const port = await startSmtpServer();
    const result = await sendSmtpMail(
      { host: '127.0.0.1', port, secure: false, username: 'alice', password: 'secret' },
      { to: ['bob@example.com'], subject: 'Hi', text: 'hello' },
    );
    expect(result.ok).toBe(true);
    expect(received.some(l => l.startsWith('AUTH LOGIN'))).toBe(true);
  });
});
