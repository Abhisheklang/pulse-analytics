'use client';

import { Column, Row, Text } from '@pulselytics/react-zen';
import { useEffect, useState } from 'react';
import { useApi } from '@/components/hooks';
import {
  Field,
  PulseShell,
  StatusMessage,
  inputStyle,
  primaryButtonStyle,
  quietButtonStyle,
  usePulseQuery,
} from './PulseShared';

// Admin settings: the Email (SMTP) section. The password field is write-only
// in practice — the API returns a mask, and saving the mask (or an empty
// value) keeps the stored password.
export function PulseSettingsPage() {
  const { put, post } = useApi();
  const { data, error, reload } = usePulseQuery<any>('/pulse/settings');
  const [form, setForm] = useState<any>(null);
  const [testTo, setTestTo] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState('');

  useEffect(() => {
    if (data?.smtp && !form) setForm(data.smtp);
  }, [data, form]);

  const save = async () => {
    setBusy('save');
    setActionError(null);
    try {
      const res: any = await put('/pulse/settings', {
        host: form.host || null,
        port: form.port === '' || form.port === null ? null : Number(form.port),
        secure: !!form.secure,
        username: form.username || null,
        password: form.password || null,
        fromName: form.fromName || null,
        fromEmail: form.fromEmail || null,
      });
      setForm(res.smtp);
      setNotice('Email settings saved.');
      await reload();
    } catch (e: any) {
      setActionError(e?.message || 'Save failed');
    } finally {
      setBusy('');
    }
  };

  const sendTest = async () => {
    setBusy('test');
    setActionError(null);
    try {
      const res: any = await post('/pulse/settings/test-email', { to: testTo });
      setNotice(`Test email sent to ${res.to} (SMTP response ${res.smtpCode}).`);
    } catch (e: any) {
      setActionError(e?.message || 'Test email failed');
    } finally {
      setBusy('');
    }
  };

  return (
    <PulseShell
      title="Settings"
      subtitle="Global Pulse settings for this server."
    >
      <StatusMessage error={error || actionError} notice={notice} />

      <Column gap="4">
        <Column gap="1">
          <Text size="lg" weight="bold">
            Email (SMTP)
          </Text>
          <Text size="sm" color="muted">
            Outgoing mail server used by email alerts and scheduled email reports. The password is
            stored on the server and never shown again — leave it as •••• to keep the current one.
          </Text>
        </Column>

        {form && (
          <>
            <Row gap="4" wrap="wrap">
              <Field label="SMTP host">
                <input
                  style={{ ...inputStyle, minWidth: 260 }}
                  value={form.host}
                  onChange={e => setForm({ ...form, host: e.target.value })}
                  placeholder="smtp.example.com"
                />
              </Field>
              <Field label="Port">
                <input
                  style={{ ...inputStyle, minWidth: 110 }}
                  type="number"
                  value={form.port}
                  onChange={e => setForm({ ...form, port: e.target.value })}
                  placeholder="587"
                />
              </Field>
              <Field label="Connection security">
                <select
                  style={inputStyle}
                  value={form.secure ? 'tls' : 'starttls'}
                  onChange={e => setForm({ ...form, secure: e.target.value === 'tls' })}
                >
                  <option value="starttls">STARTTLS (port 587)</option>
                  <option value="tls">Implicit TLS (port 465)</option>
                </select>
              </Field>
            </Row>
            <Row gap="4" wrap="wrap">
              <Field label="Username">
                <input
                  style={{ ...inputStyle, minWidth: 220 }}
                  value={form.username}
                  onChange={e => setForm({ ...form, username: e.target.value })}
                  placeholder="mailer@example.com"
                  autoComplete="off"
                />
              </Field>
              <Field label={`Password${form.hasPassword ? ' (saved)' : ''}`}>
                <input
                  style={{ ...inputStyle, minWidth: 220 }}
                  type="password"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  placeholder={form.hasPassword ? '••••••••' : 'SMTP password'}
                  autoComplete="new-password"
                />
              </Field>
            </Row>
            <Row gap="4" wrap="wrap">
              <Field label="From name">
                <input
                  style={{ ...inputStyle, minWidth: 200 }}
                  value={form.fromName}
                  onChange={e => setForm({ ...form, fromName: e.target.value })}
                  placeholder="Pulse Analytics"
                />
              </Field>
              <Field label="From email">
                <input
                  style={{ ...inputStyle, minWidth: 240 }}
                  value={form.fromEmail}
                  onChange={e => setForm({ ...form, fromEmail: e.target.value })}
                  placeholder="pulse@example.com"
                />
              </Field>
            </Row>
            <Row gap="3" alignItems="center">
              <button style={primaryButtonStyle} onClick={save} disabled={busy === 'save'}>
                {busy === 'save' ? 'Saving…' : 'Save email settings'}
              </button>
              <Text size="sm" color="muted">
                {form.configured ? 'SMTP is configured.' : 'SMTP is not configured yet.'}
              </Text>
            </Row>

            <Column gap="2">
              <Text size="base" weight="bold">
                Send a test email
              </Text>
              <Row gap="3" wrap="wrap" alignItems="center">
                <input
                  style={{ ...inputStyle, minWidth: 260 }}
                  value={testTo}
                  onChange={e => setTestTo(e.target.value)}
                  placeholder="you@example.com"
                />
                <button
                  style={quietButtonStyle}
                  onClick={sendTest}
                  disabled={busy === 'test' || !testTo}
                >
                  {busy === 'test' ? 'Sending…' : 'Send test email'}
                </button>
              </Row>
            </Column>
          </>
        )}
      </Column>
    </PulseShell>
  );
}
