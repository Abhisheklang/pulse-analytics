'use client';

import { Column, Row, Text } from '@pulselytics/react-zen';
import { useState } from 'react';
import { useApi } from '@/components/hooks';
import {
  EmptyNote,
  Field,
  PulseShell,
  StatusMessage,
  cardStyle,
  inputStyle,
  primaryButtonStyle,
  tableStyle,
  tdStyle,
  thStyle,
  usePulseQuery,
  TableWrap,
} from './PulseShared';

const SNIPPET = `<!-- The tracking script you already installed exposes a track() function.
// Send a custom event with a numeric "revenue" property and it counts
// as revenue in Pulse — no extra setup, no second snippet: -->
<script>
  track('purchase', { revenue: 49.99, currency: 'USD', plan: 'pro' });
</script>`;

export function PulseRevenuePage({ websiteId }: { websiteId: string }) {
  const { put } = useApi();
  const [days, setDays] = useState('30');
  const [currency, setCurrency] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { data, reload } = usePulseQuery<any>(
    `/pulse/websites/${websiteId}/revenue?days=${days}`,
  );

  const money = (n: number) =>
    `${data?.currency || 'USD'} ${Number(n || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const handleSaveCurrency = async () => {
    setError(null);
    try {
      await put(`/pulse/websites/${websiteId}/revenue`, {
        currency: (currency || data?.currency || 'USD').toUpperCase(),
      });
      setNotice('Default currency saved.');
      reload();
    } catch (e: any) {
      setError(e?.message || 'Save failed');
    }
  };

  return (
    <PulseShell
      title="Revenue"
      subtitle="Revenue is carried on ordinary custom events: any event whose data includes a numeric revenue value counts here. Totals below are computed live from event data."
    >
      <StatusMessage error={error} notice={notice} />

      <Row gap="3" alignItems="center">
        <Text size="2" weight="bold">
          Period
        </Text>
        <select
          style={{ ...inputStyle, minWidth: 120 }}
          value={days}
          onChange={e => setDays(e.target.value)}
        >
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
        </select>
        <Field label="Default currency">
          <Row gap="2">
            <input
              style={{ ...inputStyle, minWidth: 80 }}
              maxLength={3}
              placeholder={data?.currency || 'USD'}
              value={currency}
              onChange={e => setCurrency(e.target.value)}
            />
            <button style={primaryButtonStyle} onClick={handleSaveCurrency}>
              Save
            </button>
          </Row>
        </Field>
      </Row>

      <Row gap="3" wrap="wrap">
        <Column gap="1" style={{ ...cardStyle, minWidth: 200 }}>
          <Text size="2" weight="bold">
            Total revenue
          </Text>
          <Text size="5" weight="bold">
            {data ? money(data.total) : '…'}
          </Text>
          <Text size="2" color="muted">
            {data?.eventCount ?? 0} revenue events
          </Text>
        </Column>
        <Column gap="1" style={{ ...cardStyle, minWidth: 200 }}>
          <Text size="2" weight="bold">
            Paying visitors
          </Text>
          <Text size="5" weight="bold">
            {data?.visitors ?? 0}
          </Text>
          <Text size="2" color="muted">
            distinct visitors with revenue
          </Text>
        </Column>
        <Column gap="1" style={{ ...cardStyle, minWidth: 200 }}>
          <Text size="2" weight="bold">
            Avg revenue / visitor
          </Text>
          <Text size="5" weight="bold">
            {data ? money(data.avgPerVisitor) : '…'}
          </Text>
        </Column>
      </Row>

      {!!data?.otherCurrencies?.length && (
        <Text size="2" color="muted">
          Other currencies in this period:{' '}
          {data.otherCurrencies
            .map((c: any) => `${c.currency} ${c.total} (${c.eventCount} events)`)
            .join(' · ')}
        </Text>
      )}

      <Column gap="3">
        <Text size="4" weight="bold">
          Revenue by day
        </Text>
        {!data?.byDay?.length ? (
          <EmptyNote>No revenue events in this period yet.</EmptyNote>
        ) : (
          <TableWrap><table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Date</th>
                <th style={thStyle}>Revenue</th>
                <th style={thStyle}>Events</th>
              </tr>
            </thead>
            <tbody>
              {data.byDay.map((d: any) => (
                <tr key={d.name}>
                  <td style={tdStyle}>{d.name}</td>
                  <td style={tdStyle}>{money(d.total)}</td>
                  <td style={tdStyle}>{d.count}</td>
                </tr>
              ))}
            </tbody>
          </table></TableWrap>
        )}
      </Column>

      <Row gap="5" wrap="wrap">
        <Column gap="3" style={{ flex: 1, minWidth: 320 }}>
          <Text size="4" weight="bold">
            Revenue by page
          </Text>
          {!data?.byPage?.length ? (
            <EmptyNote>No data.</EmptyNote>
          ) : (
            <TableWrap><table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Page</th>
                  <th style={thStyle}>Revenue</th>
                  <th style={thStyle}>Events</th>
                </tr>
              </thead>
              <tbody>
                {data.byPage.map((d: any) => (
                  <tr key={d.name}>
                    <td style={tdStyle}>{d.name}</td>
                    <td style={tdStyle}>{money(d.total)}</td>
                    <td style={tdStyle}>{d.count}</td>
                  </tr>
                ))}
              </tbody>
            </table></TableWrap>
          )}
        </Column>
        <Column gap="3" style={{ flex: 1, minWidth: 320 }}>
          <Text size="4" weight="bold">
            Revenue by referrer
          </Text>
          {!data?.byReferrer?.length ? (
            <EmptyNote>No data.</EmptyNote>
          ) : (
            <TableWrap><table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Referrer</th>
                  <th style={thStyle}>Revenue</th>
                  <th style={thStyle}>Events</th>
                </tr>
              </thead>
              <tbody>
                {data.byReferrer.map((d: any) => (
                  <tr key={d.name}>
                    <td style={tdStyle}>{d.name}</td>
                    <td style={tdStyle}>{money(d.total)}</td>
                    <td style={tdStyle}>{d.count}</td>
                  </tr>
                ))}
              </tbody>
            </table></TableWrap>
          )}
        </Column>
      </Row>

      <Column gap="3">
        <Text size="4" weight="bold">
          How to track revenue
        </Text>
        <Text size="2" color="muted">
          On your checkout or success page, send a custom event whose data includes a numeric{' '}
          <b>revenue</b> value (and optionally a 3-letter <b>currency</b>; events without one use
          this website's default currency above).
        </Text>
        <pre
          style={{
            background: '#1e1b4b',
            color: '#e0e7ff',
            padding: 16,
            borderRadius: 'var(--pulse-radius-control)',
            fontSize: 13,
            overflowX: 'auto',
            margin: 0,
          }}
        >
          {SNIPPET}
        </pre>
      </Column>
    </PulseShell>
  );
}
