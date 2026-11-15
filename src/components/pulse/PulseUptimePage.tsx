'use client';

import { Column, Row, Text } from '@pulselytics/react-zen';
import { useEffect, useState } from 'react';
import { useApi } from '@/components/hooks';
import {
  EmptyNote,
  Field,
  PulseShell,
  StatusMessage,
  cardStyle,
  formatDateTime,
  inputStyle,
  primaryButtonStyle,
  quietButtonStyle,
  tableStyle,
  tdStyle,
  thStyle,
  usePulseQuery,
  TableWrap,
  StatusChip,
} from './PulseShared';

export function PulseUptimePage({ websiteId }: { websiteId: string }) {
  const { put, post } = useApi();
  const { data, reload } = usePulseQuery<any>(`/pulse/websites/${websiteId}/uptime`);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    enabled: false,
    url: '',
    intervalMinutes: '5',
    notifyWebhookUrl: '',
  });

  const monitor = data?.monitor;

  useEffect(() => {
    if (monitor) {
      setForm({
        enabled: monitor.enabled,
        url: monitor.url,
        intervalMinutes: String(monitor.intervalMinutes),
        notifyWebhookUrl: monitor.notifyWebhookUrl || '',
      });
    }
  }, [monitor?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async () => {
    setError(null);
    try {
      await put(`/pulse/websites/${websiteId}/uptime`, {
        enabled: form.enabled,
        url: form.url,
        intervalMinutes: Number(form.intervalMinutes),
        notifyWebhookUrl: form.notifyWebhookUrl || undefined,
      });
      setNotice('Monitor saved.');
      reload();
    } catch (e: any) {
      setError(e?.message || 'Save failed');
    }
  };

  const handleRunChecks = async () => {
    setError(null);
    try {
      const result = await post(`/pulse/cron/uptime`, { websiteId });
      setNotice(`Ran ${result.checked} check(s): ${result.up} up, ${result.down} down.`);
      reload();
    } catch (e: any) {
      setError(e?.message || 'Check run failed');
    }
  };

  const status = data?.currentStatus || 'unknown';
  const statusColor =
    status === 'up' ? '#16a34a' : status === 'down' ? '#dc2626' : '#6b7280';

  return (
    <PulseShell
      title="Uptime Monitoring"
      subtitle="Pulse periodically checks that this website responds, records response times, and opens an incident (with a webhook notification) when it goes down. Checks run from the cron trigger endpoint POST /api/pulse/cron/uptime — point system cron at it using the interval below."
    >
      <StatusMessage error={error} notice={notice} />

      <Row gap="3" wrap="wrap">
        <Column gap="1" style={{ ...cardStyle, minWidth: 200 }}>
          <Text size="2" weight="bold">
            Current status
          </Text>
          <Text size="5" weight="bold" style={{ color: statusColor }}>
            {status === 'up' ? '● Up' : status === 'down' ? '● Down' : 'Unknown'}
          </Text>
          <Text size="2" color="muted">
            {data?.lastCheck
              ? `Last check ${formatDateTime(data.lastCheck.createdAt)} · ${data.lastCheck.responseMs} ms${data.lastCheck.status ? ` · HTTP ${data.lastCheck.status}` : ''}`
              : 'No checks yet'}
          </Text>
        </Column>
        <Column gap="1" style={{ ...cardStyle, minWidth: 160 }}>
          <Text size="2" weight="bold">
            Uptime (24h)
          </Text>
          <Text size="5" weight="bold">
            {data?.uptime24h != null ? `${data.uptime24h}%` : '—'}
          </Text>
          <Text size="2" color="muted">
            {data?.checks24h ?? 0} checks
          </Text>
        </Column>
        <Column gap="1" style={{ ...cardStyle, minWidth: 160 }}>
          <Text size="2" weight="bold">
            Uptime (30d)
          </Text>
          <Text size="5" weight="bold">
            {data?.uptime30d != null ? `${data.uptime30d}%` : '—'}
          </Text>
          <Text size="2" color="muted">
            {data?.checks30d ?? 0} checks
          </Text>
        </Column>
      </Row>

      <Column gap="2">
        <Text size="4" weight="bold">
          Public status page
        </Text>
        {data?.statusPage?.enabled ? (
          <>
            <Text size="2" color="muted">
              Share this page publicly — it shows the current status, uptime and recent
              checks for this website. It is protected by the same per-site token as the
              live badge, so only people with the link can open it.
            </Text>
            <code style={{ fontSize: 13, wordBreak: 'break-all' }}>
              {`${typeof window !== 'undefined' ? window.location.origin : ''}${data.statusPage.path}?token=${data.statusPage.token}`}
            </code>
          </>
        ) : (
          <Text size="2" color="muted">
            Not enabled. The public status page uses the live badge&rsquo;s per-site token —
            enable the badge on the Badge &amp; Webhooks page and the status page will be
            available at <code>{data?.statusPage?.path || `/status/${websiteId}`}</code> with
            that token.
          </Text>
        )}
      </Column>

      <Column gap="3">
        <Text size="4" weight="bold">
          Monitor settings
        </Text>
        <Row gap="3" wrap="wrap" alignItems="flex-end">
          <Field label="Enabled">
            <select
              style={{ ...inputStyle, minWidth: 100 }}
              value={form.enabled ? 'yes' : 'no'}
              onChange={e => setForm({ ...form, enabled: e.target.value === 'yes' })}
            >
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </Field>
          <Field label="Check URL">
            <input
              style={{ ...inputStyle, minWidth: 300 }}
              value={form.url}
              onChange={e => setForm({ ...form, url: e.target.value })}
              placeholder="https://example.com/"
            />
          </Field>
          <Field label="Interval (minutes)">
            <input
              style={{ ...inputStyle, minWidth: 100 }}
              type="number"
              min={1}
              value={form.intervalMinutes}
              onChange={e => setForm({ ...form, intervalMinutes: e.target.value })}
            />
          </Field>
          <Field label="Down-alert webhook (optional)">
            <input
              style={{ ...inputStyle, minWidth: 260 }}
              value={form.notifyWebhookUrl}
              onChange={e => setForm({ ...form, notifyWebhookUrl: e.target.value })}
              placeholder="https://example.com/hook"
            />
          </Field>
          <button style={primaryButtonStyle} onClick={handleSave}>
            Save monitor
          </button>
          <button style={quietButtonStyle} onClick={handleRunChecks}>
            Run check now
          </button>
        </Row>
      </Column>

      <Column gap="3">
        <Text size="4" weight="bold">
          Incidents
        </Text>
        {!data?.incidents?.length ? (
          <EmptyNote>No incidents recorded.</EmptyNote>
        ) : (
          <TableWrap><table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Started</th>
                <th style={thStyle}>Resolved</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Notified</th>
              </tr>
            </thead>
            <tbody>
              {data.incidents.map((i: any) => (
                <tr key={i.id}>
                  <td style={tdStyle}>{formatDateTime(i.startedAt)}</td>
                  <td style={tdStyle}>{i.endedAt ? formatDateTime(i.endedAt) : '—'}</td>
                  <td style={tdStyle}>{i.endedAt ? 'Resolved' : '🔴 Open'}</td>
                  <td style={tdStyle}>{i.notified ? 'Yes' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table></TableWrap>
        )}
      </Column>

      <Column gap="3">
        <Text size="4" weight="bold">
          Recent checks
        </Text>
        {!data?.recentChecks?.length ? (
          <EmptyNote>No checks yet. Save the monitor, enable it, then “Run check now”.</EmptyNote>
        ) : (
          <TableWrap><table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Time</th>
                <th style={thStyle}>Result</th>
                <th style={thStyle}>HTTP status</th>
                <th style={thStyle}>Response</th>
                <th style={thStyle}>Error</th>
              </tr>
            </thead>
            <tbody>
              {data.recentChecks.map((c: any) => (
                <tr key={c.id}>
                  <td style={tdStyle}>{formatDateTime(c.createdAt)}</td>
                  <td style={tdStyle}>
                    <StatusChip tone={c.up ? 'success' : 'danger'}>{c.up ? 'Up' : 'Down'}</StatusChip>
                  </td>
                  <td style={tdStyle}>{c.status ?? '—'}</td>
                  <td style={tdStyle}>{c.responseMs} ms</td>
                  <td style={tdStyle}>{c.error || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table></TableWrap>
        )}
      </Column>
    </PulseShell>
  );
}
