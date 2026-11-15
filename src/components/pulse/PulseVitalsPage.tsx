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

const METRIC_LABELS: Record<string, string> = {
  lcp: 'LCP (loading)',
  inp: 'INP (interaction)',
  cls: 'CLS (stability)',
  fcp: 'FCP (first paint)',
  ttfb: 'TTFB (server)',
};

const RATING_STYLE: Record<string, React.CSSProperties> = {
  good: { background: '#dcfce7', color: '#166534' },
  'needs-improvement': { background: '#fef9c3', color: '#854d0e' },
  poor: { background: '#fee2e2', color: '#991b1b' },
};

function formatValue(metric: string, value: number) {
  return metric === 'cls' ? String(value) : `${value} ms`;
}

function RatingChip({ metric, summary }: { metric: string; summary: any }) {
  if (!summary) return <Text color="muted">—</Text>;
  return (
    <span
      style={{
        ...RATING_STYLE[summary.rating],
        padding: '2px 8px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      {formatValue(metric, summary.p75)} p75 · {formatValue(metric, summary.avg)} avg
    </span>
  );
}

export function PulseVitalsPage({ websiteId }: { websiteId: string }) {
  const [days, setDays] = useState('30');
  const { data, error } = usePulseQuery<any>(
    `/pulse/websites/${websiteId}/vitals?days=${days}`,
  );

  const summary = data?.summary || {};
  const pages = data?.pages || [];
  const metrics = Object.keys(METRIC_LABELS);

  return (
    <PulseShell
      title="Web Vitals"
      subtitle="Core Web Vitals measured in your visitors' browsers by the optional Pulse vitals add-on script. It reports LCP, INP, CLS, FCP and TTFB as events, without cookies."
    >
      <StatusMessage error={error} />

      <Text size="2" color="muted">
        To collect vitals, add this add-on next to the standard tracking script on your site:{' '}
        <code>{'<script async src="/pulse-vitals.js"></script>'}</code>
      </Text>

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
          {data ? `${data.eventCount} vitals events collected` : 'Loading…'}
        </Text>
      </Row>

      <Row gap="3" wrap="wrap">
        {metrics.map(metric => (
          <Column key={metric} gap="1" style={{ ...cardStyle, minWidth: 180 }}>
            <Text size="2" weight="bold">
              {METRIC_LABELS[metric]}
            </Text>
            <RatingChip metric={metric} summary={summary[metric]} />
            <Text size="2" color="muted">
              {summary[metric]
                ? `${summary[metric].count} samples · good ≤ ${formatValue(metric, data.thresholds[metric].good)}`
                : 'No samples yet'}
            </Text>
          </Column>
        ))}
      </Row>

      <Column gap="3">
        <Text size="4" weight="bold">
          By page
        </Text>
        {pages.length === 0 ? (
          <EmptyNote>
            No vitals data yet. Once visitors load pages with the vitals add-on script, per-page
            scores appear here.
          </EmptyNote>
        ) : (
          <TableWrap><table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Page</th>
                {metrics.map(m => (
                  <th key={m} style={thStyle}>
                    {m.toUpperCase()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pages.map((page: any) => (
                <tr key={page.path}>
                  <td style={tdStyle}>{page.path}</td>
                  {metrics.map(m => (
                    <td key={m} style={tdStyle}>
                      <RatingChip metric={m} summary={page.metrics[m]} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table></TableWrap>
        )}
        <Text size="2" color="muted">
          Thresholds: LCP good ≤ 2.5s, INP good ≤ 200ms, CLS good ≤ 0.1. Chips show the p75 value
          (75% of visits were at or below it) coloured by rating.
        </Text>
      </Column>
    </PulseShell>
  );
}
