'use client';

import { Column, Row, Text } from '@pulselytics/react-zen';
import { useState } from 'react';
import { useApi } from '@/components/hooks';
import {
  ChannelFields,
  channelPayload,
  channelTargetText,
  EmptyNote,
  Field,
  PulseShell,
  StatusMessage,
  dangerButtonStyle,
  emptyChannelForm,
  formatDateTime,
  inputStyle,
  primaryButtonStyle,
  quietButtonStyle,
  tableStyle,
  tdStyle,
  thStyle,
  usePulseQuery,
  type ChannelFormState,
  TableWrap,
} from './PulseShared';

export function PulseReportsPage({ websiteId }: { websiteId: string }) {
  const { post, del } = useApi();
  const { data, reload } = usePulseQuery<any>(`/pulse/websites/${websiteId}/reports`);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', frequency: 'weekly', email: '' });
  const [channelForm, setChannelForm] = useState<ChannelFormState>(emptyChannelForm);

  const schedules = data?.schedules || [];
  const logs = data?.logs || [];

  const handleCreate = async () => {
    setError(null);
    try {
      await post(`/pulse/websites/${websiteId}/reports`, {
        name: form.name || 'Summary report',
        frequency: form.frequency,
        email: form.email || undefined,
        ...channelPayload(channelForm),
      });
      setNotice('Report schedule created.');
      setForm({ name: '', frequency: 'weekly', email: '' });
      setChannelForm(emptyChannelForm);
      reload();
    } catch (e: any) {
      setError(e?.message || 'Failed to create schedule');
    }
  };

  const handleSendNow = async (schedule: any) => {
    setError(null);
    try {
      const log = await post(`/pulse/websites/${websiteId}/reports/${schedule.id}/send`, {});
      setNotice(
        `Report sent. Delivered via ${log.channel || 'webhook'}: ${log.delivered ? 'yes' : 'no'}.`,
      );
      reload();
    } catch (e: any) {
      setError(e?.message || 'Send failed');
    }
  };

  const handleDelete = async (schedule: any) => {
    if (!window.confirm(`Delete the report schedule "${schedule.name}"? This cannot be undone.`)) return;
    try {
      await del(`/pulse/websites/${websiteId}/reports`, { id: schedule.id });
      reload();
    } catch (e: any) {
      setError(e?.message || 'Delete failed');
    }
  };

  return (
    <PulseShell
      title="Pulse Scheduled Reports"
      subtitle="Daily or weekly traffic summaries (visitors, views, bounce, top pages, referrers, countries) delivered to a webhook, Slack, Discord, or Telegram, with a CSV copy stored in the report history. Due schedules are sent by POST /api/pulse/cron/reports."
    >
      <StatusMessage error={error} notice={notice} />

      <Column gap="3">
        <Text size="lg" weight="bold">
          Create schedule
        </Text>
        <Row gap="3" wrap="wrap" alignItems="flex-end">
          <Field label="Name">
            <input
              style={inputStyle}
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="Weekly digest"
            />
          </Field>
          <Field label="Frequency">
            <select
              style={inputStyle}
              value={form.frequency}
              onChange={e => setForm({ ...form, frequency: e.target.value })}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </Field>
          <ChannelFields value={channelForm} onChange={setChannelForm} />
          <Field label="Email (optional)">
            <input
              style={inputStyle}
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              placeholder="team@example.com"
            />
          </Field>
          <button style={primaryButtonStyle} onClick={handleCreate}>
            Create schedule
          </button>
        </Row>
        <Text size="sm" color="muted">
          Email delivery is recorded and config-gated (requires PULSE_SMTP_URL); webhook delivery is fully
          functional.
        </Text>
      </Column>

      <Column gap="3">
        <Text size="lg" weight="bold">
          Schedules ({schedules.length})
        </Text>
        {schedules.length === 0 ? (
          <EmptyNote>No schedules yet.</EmptyNote>
        ) : (
          <TableWrap><table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Frequency</th>
                <th style={thStyle}>Destination</th>
                <th style={thStyle}>Last sent</th>
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {schedules.map((s: any) => (
                <tr key={s.id}>
                  <td style={tdStyle}>{s.name}</td>
                  <td style={tdStyle}>{s.frequency}</td>
                  <td style={{ ...tdStyle, wordBreak: 'break-all', maxWidth: 280 }}>
                    {s.channel && s.channel !== 'webhook'
                      ? channelTargetText(s)
                      : s.webhookUrl || s.email || '-'}
                    {s.email ? ` · ${s.email}` : ''}
                  </td>
                  <td style={tdStyle}>{formatDateTime(s.lastSentAt)}</td>
                  <td style={tdStyle}>
                    <Row gap="2">
                      <button style={quietButtonStyle} onClick={() => handleSendNow(s)}>
                        Send now
                      </button>
                      <button style={dangerButtonStyle} onClick={() => handleDelete(s)}>
                        Delete
                      </button>
                    </Row>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></TableWrap>
        )}
      </Column>

      <Column gap="3">
        <Text size="lg" weight="bold">
          Report history
        </Text>
        {logs.length === 0 ? (
          <EmptyNote>No reports sent yet. Use “Send now”.</EmptyNote>
        ) : (
          <TableWrap><table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Sent</th>
                <th style={thStyle}>Channel</th>
                <th style={thStyle}>Delivered</th>
                <th style={thStyle}>Summary</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log: any) => (
                <tr key={log.id}>
                  <td style={tdStyle}>{formatDateTime(log.createdAt)}</td>
                  <td style={tdStyle}>{log.channel || 'webhook'}</td>
                  <td style={tdStyle}>
                    {log.delivered ? `Yes${log.deliveryStatus ? ` (${log.deliveryStatus})` : ''}` : 'No'}
                  </td>
                  <td style={tdStyle}>
                    {log.summary?.periodDays}-day: {log.summary?.current?.visitors} visitors,{' '}
                    {log.summary?.current?.pageviews} views, bounce {log.summary?.current?.bounceRate}%
                    {log.summary?.emailNote ? ` · ${log.summary.emailNote}` : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></TableWrap>
        )}
      </Column>
    </PulseShell>
  );
}
