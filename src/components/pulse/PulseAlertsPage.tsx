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

export function PulseAlertsPage({ websiteId }: { websiteId: string }) {
  const { post, del } = useApi();
  const { data, reload } = usePulseQuery<any>(`/pulse/websites/${websiteId}/alerts`);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    metric: 'pageviews',
    condition: 'spike',
    threshold: '50',
    windowHours: '24',
  });
  const [channelForm, setChannelForm] = useState<ChannelFormState>(emptyChannelForm);

  const rules = data?.rules || [];
  const logs = data?.logs || [];

  const handleCreate = async () => {
    setError(null);
    try {
      await post(`/pulse/websites/${websiteId}/alerts`, {
        name: form.name || 'Untitled rule',
        metric: form.metric,
        condition: form.condition,
        threshold: Number(form.threshold),
        windowHours: Number(form.windowHours),
        ...channelPayload(channelForm),
      });
      setNotice('Alert rule created.');
      setForm({ ...form, name: '' });
      setChannelForm(emptyChannelForm);
      reload();
    } catch (e: any) {
      setError(e?.message || 'Failed to create rule');
    }
  };

  const handleEvaluate = async () => {
    setError(null);
    try {
      const result = await post(`/pulse/cron/alerts`, { websiteId });
      setNotice(`Evaluated ${result.evaluated} rule(s); ${result.fired} fired.`);
      reload();
    } catch (e: any) {
      setError(e?.message || 'Evaluation failed');
    }
  };

  const handleDelete = async (rule: any) => {
    if (!window.confirm(`Delete the alert rule "${rule.name}"? This cannot be undone.`)) return;
    try {
      await del(`/pulse/websites/${websiteId}/alerts/${rule.id}`);
      reload();
    } catch (e: any) {
      setError(e?.message || 'Delete failed');
    }
  };

  return (
    <PulseShell
      title="Pulse Alerts"
      subtitle="Get notified when traffic spikes, drops, crosses a threshold, or stops — delivered to a generic webhook, Slack, Discord, or Telegram. Rules are evaluated by the cron trigger endpoint (POST /api/pulse/cron/alerts) — point system cron at it, or evaluate manually below."
    >
      <StatusMessage error={error} notice={notice} />

      <Column gap="3">
        <Text size="lg" weight="bold">
          Create rule
        </Text>
        <Row gap="3" wrap="wrap" alignItems="flex-end">
          <Field label="Name">
            <input
              style={inputStyle}
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="Traffic spike"
            />
          </Field>
          <Field label="Metric">
            <select
              style={inputStyle}
              value={form.metric}
              onChange={e => setForm({ ...form, metric: e.target.value })}
            >
              <option value="pageviews">Pageviews</option>
              <option value="visitors">Visitors</option>
            </select>
          </Field>
          <Field label="Condition">
            <select
              style={inputStyle}
              value={form.condition}
              onChange={e => setForm({ ...form, condition: e.target.value })}
            >
              <option value="spike">Spike %</option>
              <option value="drop">Drop %</option>
              <option value="above">Above threshold</option>
              <option value="below">Below threshold</option>
              <option value="nodata">No data</option>
            </select>
          </Field>
          <Field label="Threshold">
            <input
              style={{ ...inputStyle, minWidth: 90 }}
              type="number"
              value={form.threshold}
              onChange={e => setForm({ ...form, threshold: e.target.value })}
            />
          </Field>
          <Field label="Window (hours)">
            <input
              style={{ ...inputStyle, minWidth: 90 }}
              type="number"
              value={form.windowHours}
              onChange={e => setForm({ ...form, windowHours: e.target.value })}
            />
          </Field>
          <ChannelFields value={channelForm} onChange={setChannelForm} />
          <button style={primaryButtonStyle} onClick={handleCreate}>
            Create rule
          </button>
          <button style={quietButtonStyle} onClick={handleEvaluate}>
            Evaluate now
          </button>
        </Row>
      </Column>

      <Column gap="3">
        <Text size="lg" weight="bold">
          Rules ({rules.length})
        </Text>
        {rules.length === 0 ? (
          <EmptyNote>No alert rules yet. Create one above.</EmptyNote>
        ) : (
          <TableWrap><table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Condition</th>
                <th style={thStyle}>Delivery</th>
                <th style={thStyle}>Enabled</th>
                <th style={thStyle}>Last fired</th>
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule: any) => (
                <tr key={rule.id}>
                  <td style={tdStyle}>{rule.name}</td>
                  <td style={tdStyle}>
                    {rule.metric} {rule.condition} {rule.threshold} (last {rule.windowHours}h)
                  </td>
                  <td style={{ ...tdStyle, wordBreak: 'break-all', maxWidth: 260 }}>
                    {channelTargetText(rule)}
                  </td>
                  <td style={tdStyle}>{rule.enabled ? 'Yes' : 'No'}</td>
                  <td style={tdStyle}>{formatDateTime(rule.lastFiredAt)}</td>
                  <td style={tdStyle}>
                    <button style={dangerButtonStyle} onClick={() => handleDelete(rule)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></TableWrap>
        )}
      </Column>

      <Column gap="3">
        <Text size="lg" weight="bold">
          Evaluation history
        </Text>
        {logs.length === 0 ? (
          <EmptyNote>No evaluations yet. Use “Evaluate now”.</EmptyNote>
        ) : (
          <TableWrap><table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Time</th>
                <th style={thStyle}>Fired</th>
                <th style={thStyle}>Channel</th>
                <th style={thStyle}>Delivered</th>
                <th style={thStyle}>Message</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log: any) => (
                <tr key={log.id}>
                  <td style={tdStyle}>{formatDateTime(log.createdAt)}</td>
                  <td style={tdStyle}>{log.fired ? '🔥 Yes' : 'No'}</td>
                  <td style={tdStyle}>{log.channel || 'webhook'}</td>
                  <td style={tdStyle}>
                    {log.fired
                      ? log.delivered
                        ? `Yes${log.deliveryStatus ? ` (${log.deliveryStatus})` : ''}`
                        : 'Failed'
                      : '—'}
                  </td>
                  <td style={tdStyle}>{log.message}</td>
                </tr>
              ))}
            </tbody>
          </table></TableWrap>
        )}
      </Column>
    </PulseShell>
  );
}
