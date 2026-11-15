'use client';

import { Column, Row, Text } from '@pulselytics/react-zen';
import { useState } from 'react';
import {
  EmptyNote,
  PulseShell,
  StatusMessage,
  cardStyle,
  inputStyle,
  tableStyle,
  tdStyle,
  thStyle,
  usePulseQuery,
  TableWrap,
} from './PulseShared';

export function PulseRollupPage() {
  const [days, setDays] = useState('30');
  const { data, error } = usePulseQuery<any>(`/pulse/rollup?days=${days}`);

  const totals = data?.totals;
  const perSite = data?.perSite || [];
  const trend = data?.trend || [];
  const maxTrend = Math.max(1, ...trend.map((t: any) => t.pageviews));

  return (
    <PulseShell
      title="Pulse Roll-up — All Websites"
      subtitle="Combined traffic across every website on this account: totals, a per-site comparison, and the combined daily trend."
    >
      <StatusMessage error={error} />

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
        <Text size="2" color="muted">
          {data ? `${perSite.length} websites included` : 'Loading…'}
        </Text>
      </Row>

      <Row gap="3" wrap="wrap">
        {[
          ['Visitors (all sites)', totals?.visitors],
          ['Views (all sites)', totals?.pageviews],
          ['Visits (all sites)', totals?.visits],
          ['Bounce rate', totals ? `${totals.bounceRate}%` : undefined],
        ].map(([label, value]) => (
          <Column key={label as string} gap="1" style={{ ...cardStyle, minWidth: 180 }}>
            <Text size="2" weight="bold">
              {label}
            </Text>
            <Text size="5" weight="bold">
              {value ?? '…'}
            </Text>
          </Column>
        ))}
      </Row>

      <Column gap="3">
        <Text size="4" weight="bold">
          Combined daily trend
        </Text>
        {trend.length === 0 ? (
          <EmptyNote>No pageviews in this period.</EmptyNote>
        ) : (
          <Row gap="1" alignItems="flex-end" style={{ height: 120 }}>
            {trend.map((t: any) => (
              <div
                key={t.date}
                title={`${t.date}: ${t.pageviews} views`}
                style={{
                  flex: 1,
                  minWidth: 4,
                  height: `${Math.max(3, (t.pageviews / maxTrend) * 100)}%`,
                  background: '#4f46e5',
                  borderRadius: '3px 3px 0 0',
                }}
              />
            ))}
          </Row>
        )}
      </Column>

      <Column gap="3">
        <Text size="4" weight="bold">
          Per-site comparison
        </Text>
        {perSite.length === 0 ? (
          <EmptyNote>No websites found for this account.</EmptyNote>
        ) : (
          <TableWrap><table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Website</th>
                <th style={thStyle}>Domain</th>
                <th style={thStyle}>Visitors</th>
                <th style={thStyle}>Views</th>
                <th style={thStyle}>Visits</th>
                <th style={thStyle}>Bounce rate</th>
              </tr>
            </thead>
            <tbody>
              {perSite.map((s: any) => (
                <tr key={s.websiteId}>
                  <td style={tdStyle}>{s.name}</td>
                  <td style={tdStyle}>{s.domain || '-'}</td>
                  <td style={tdStyle}>{s.visitors}</td>
                  <td style={tdStyle}>{s.pageviews}</td>
                  <td style={tdStyle}>{s.visits}</td>
                  <td style={tdStyle}>{s.bounceRate}%</td>
                </tr>
              ))}
              {totals && (
                <tr>
                  <td style={{ ...tdStyle, fontWeight: 700 }}>All websites</td>
                  <td style={tdStyle}>—</td>
                  <td style={{ ...tdStyle, fontWeight: 700 }}>{totals.visitors}</td>
                  <td style={{ ...tdStyle, fontWeight: 700 }}>{totals.pageviews}</td>
                  <td style={{ ...tdStyle, fontWeight: 700 }}>{totals.visits}</td>
                  <td style={{ ...tdStyle, fontWeight: 700 }}>{totals.bounceRate}%</td>
                </tr>
              )}
            </tbody>
          </table></TableWrap>
        )}
      </Column>
    </PulseShell>
  );
}
