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
} from './PulseShared';

export function PulseBadgePage({ websiteId }: { websiteId: string }) {
  const { put } = useApi();
  const privacy = usePulseQuery<any>(`/pulse/websites/${websiteId}/privacy`);
  const webhooks = usePulseQuery<any>(`/pulse/websites/${websiteId}/webhooks`);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [origin, setOrigin] = useState('');
  const [hookForm, setHookForm] = useState({ url: '', events: 'all', secret: '', enabled: true });

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (webhooks.data?.config) {
      setHookForm({
        url: webhooks.data.config.url,
        events: webhooks.data.config.events,
        secret: webhooks.data.config.secret || '',
        enabled: webhooks.data.config.enabled,
      });
    }
  }, [webhooks.data]);

  const setting = privacy.data?.setting;
  const badgeUrl =
    setting?.badgeToken && origin
      ? `${origin}/api/pulse/badge/${websiteId}.svg?token=${setting.badgeToken}`
      : '';
  const embed = badgeUrl ? `<img src="${badgeUrl}" alt="Pulse Analytics visitors today" />` : '';

  const toggleBadge = async (enabled: boolean) => {
    try {
      await put(`/pulse/websites/${websiteId}/privacy`, { badgeEnabled: enabled });
      setNotice(`Public badge ${enabled ? 'enabled' : 'disabled'}.`);
      privacy.reload();
    } catch (e: any) {
      setError(e?.message || 'Failed to update badge');
    }
  };

  const regenToken = async () => {
    try {
      await put(`/pulse/websites/${websiteId}/privacy`, { regenerateBadgeToken: true });
      setNotice('Badge token regenerated. Old badge URLs stop working.');
      privacy.reload();
    } catch (e: any) {
      setError(e?.message || 'Failed to regenerate token');
    }
  };

  const saveWebhook = async () => {
    try {
      await put(`/pulse/websites/${websiteId}/webhooks`, hookForm);
      setNotice('Webhook forwarding saved.');
      webhooks.reload();
    } catch (e: any) {
      setError(e?.message || 'Failed to save webhook');
    }
  };

  const deliveries = webhooks.data?.deliveries || [];

  return (
    <PulseShell
      title="Badge & Webhooks"
      subtitle="Show a live 'visitors today' badge on your site, and forward accepted analytics events to any webhook in real time."
    >
      <StatusMessage error={error} notice={notice} />

      <Column gap="3" style={cardStyle}>
        <Text size="4" weight="bold">
          Public live badge
        </Text>
        <Text>
          Status: <b>{setting?.badgeEnabled ? 'Enabled' : 'Disabled'}</b>
          {setting?.badgeEnabled
            ? ' — anyone with the badge URL can see today’s visitor and view counts for this website.'
            : ' — the badge endpoint returns 404 until enabled.'}
        </Text>
        <Row gap="3">
          <button style={primaryButtonStyle} onClick={() => toggleBadge(!setting?.badgeEnabled)}>
            {setting?.badgeEnabled ? 'Disable badge' : 'Enable badge'}
          </button>
          <button style={quietButtonStyle} onClick={regenToken}>
            Regenerate token
          </button>
        </Row>
        {setting?.badgeEnabled && badgeUrl && (
          <Column gap="2">
            <Text weight="bold" size="2">
              Preview
            </Text>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={badgeUrl} alt="Pulse visitors today badge" width={190} height={20} />
            <Text weight="bold" size="2">
              Embed snippet
            </Text>
            <code style={{ wordBreak: 'break-all', fontSize: 12 }}>{embed}</code>
          </Column>
        )}
      </Column>

      <Column gap="3" style={cardStyle}>
        <Text size="4" weight="bold">
          Event webhook forwarding
        </Text>
        <Text size="2" color="muted">
          Accepted events from the tracking script are forwarded best-effort (3s timeout, never blocks
          collection). An optional secret is sent as the x-pulse-secret header.
        </Text>
        <Row gap="3" wrap="wrap" alignItems="flex-end">
          <Field label="Webhook URL">
            <input
              style={{ ...inputStyle, minWidth: 280 }}
              value={hookForm.url}
              onChange={e => setHookForm({ ...hookForm, url: e.target.value })}
              placeholder="https://example.com/hooks/pulse"
            />
          </Field>
          <Field label="Events">
            <select
              style={inputStyle}
              value={hookForm.events}
              onChange={e => setHookForm({ ...hookForm, events: e.target.value })}
            >
              <option value="all">All events</option>
              <option value="pageview">Pageviews only</option>
              <option value="custom">Custom events only</option>
            </select>
          </Field>
          <Field label="Secret (optional)">
            <input
              style={inputStyle}
              value={hookForm.secret}
              onChange={e => setHookForm({ ...hookForm, secret: e.target.value })}
            />
          </Field>
          <Field label="Enabled">
            <select
              style={inputStyle}
              value={hookForm.enabled ? 'yes' : 'no'}
              onChange={e => setHookForm({ ...hookForm, enabled: e.target.value === 'yes' })}
            >
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </Field>
          <button style={primaryButtonStyle} onClick={saveWebhook}>
            Save webhook
          </button>
        </Row>

        <Text weight="bold" size="3">
          Recent deliveries ({deliveries.length})
        </Text>
        {deliveries.length === 0 ? (
          <EmptyNote>No forwarded events yet.</EmptyNote>
        ) : (
          <TableWrap><table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Time</th>
                <th style={thStyle}>Event</th>
                <th style={thStyle}>Path</th>
                <th style={thStyle}>Delivered</th>
                <th style={thStyle}>Status</th>
              </tr>
            </thead>
            <tbody>
              {deliveries.map((d: any) => (
                <tr key={d.id}>
                  <td style={tdStyle}>{formatDateTime(d.createdAt)}</td>
                  <td style={tdStyle}>{d.eventName || (d.eventType === 1 ? 'pageview' : `type ${d.eventType}`)}</td>
                  <td style={tdStyle}>{d.urlPath || '-'}</td>
                  <td style={tdStyle}>{d.ok ? 'Yes' : `No${d.error ? ` (${d.error})` : ''}`}</td>
                  <td style={tdStyle}>{d.status ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table></TableWrap>
        )}
      </Column>
    </PulseShell>
  );
}
