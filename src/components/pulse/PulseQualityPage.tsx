'use client';

import { Column, Row, Text } from '@pulselytics/react-zen';
import {
  EmptyNote,
  PulseShell,
  cardStyle,
  tableStyle,
  tdStyle,
  thStyle,
  usePulseQuery,
  TableWrap,
} from './PulseShared';

function MiniTable({
  title,
  rows,
  columns,
}: {
  title: string;
  rows: any[];
  columns: { label: string; render: (r: any) => React.ReactNode }[];
}) {
  return (
    <Column gap="2" style={{ ...cardStyle, flex: '1 1 420px' }}>
      <Text weight="bold">{title}</Text>
      {rows.length === 0 ? (
        <Text color="muted" size="sm">
          No data.
        </Text>
      ) : (
        <TableWrap><table style={tableStyle}>
          <thead>
            <tr>
              {columns.map(c => (
                <th key={c.label} style={thStyle}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                {columns.map(c => (
                  <td key={c.label} style={tdStyle}>
                    {c.render(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table></TableWrap>
      )}
    </Column>
  );
}

export function PulseQualityPage({ websiteId }: { websiteId: string }) {
  const { data, loading } = usePulseQuery<any>(`/pulse/websites/${websiteId}/quality?days=30`);
  const report = data;

  return (
    <PulseShell
      title="Data Quality & Broken Pages"
      subtitle="Potential broken pages, where their traffic comes from, and referrer quality signals for the last 30 days."
    >
      {loading && !report ? (
        <EmptyNote>Loading report…</EmptyNote>
      ) : report ? (
        <>
          <Row gap="3" wrap="wrap">
            <Column style={cardStyle} gap="1">
              <Text size="sm" color="muted">Pageviews (30d)</Text>
              <Text size="xl" weight="bold">{report.totalPageviews}</Text>
            </Column>
            <Column style={cardStyle} gap="1">
              <Text size="sm" color="muted">Broken-page views</Text>
              <Text size="xl" weight="bold">{report.brokenViews} ({report.brokenShare}%)</Text>
            </Column>
            <Column style={cardStyle} gap="1">
              <Text size="sm" color="muted">Views with no referrer</Text>
              <Text size="xl" weight="bold">{report.noReferrerShare}%</Text>
            </Column>
            <Column style={cardStyle} gap="1">
              <Text size="sm" color="muted">Spam referrers flagged</Text>
              <Text size="xl" weight="bold">{report.spamReferrers?.length || 0}</Text>
            </Column>
          </Row>

          <Row gap="4" wrap="wrap" alignItems="flex-start">
            <MiniTable
              title="Potential broken pages"
              rows={report.brokenPages || []}
              columns={[
                { label: 'Page', render: r => r.name },
                { label: 'Views', render: r => r.count },
              ]}
            />
            <MiniTable
              title="Top referrers to broken pages"
              rows={report.brokenReferrers || []}
              columns={[
                { label: 'Referrer', render: r => r.name },
                { label: 'Views', render: r => r.count },
              ]}
            />
          </Row>

          <Row gap="4" wrap="wrap" alignItems="flex-start">
            <MiniTable
              title="Bounce-heavy pages (≥80% single-view sessions)"
              rows={report.bounceHeavyPages || []}
              columns={[
                { label: 'Page', render: r => r.name },
                { label: 'Page sessions', render: r => r.sessions },
                { label: 'Bounce', render: r => `${r.bounceRate}%` },
              ]}
            />
            <MiniTable
              title="Top referrer domains"
              rows={report.topReferrers || []}
              columns={[
                { label: 'Referrer', render: r => (r.spam ? `⚠️ ${r.name} (spam list)` : r.name) },
                { label: 'Views', render: r => r.count },
              ]}
            />
          </Row>
        </>
      ) : (
        <EmptyNote>Report unavailable.</EmptyNote>
      )}
    </PulseShell>
  );
}
