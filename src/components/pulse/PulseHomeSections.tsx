'use client';

import { Column, Row, Text } from '@pulselytics/react-zen';
import { useMemo } from 'react';
import Link from '@/components/common/Link';
import {
  useLoginQuery,
  useNavigation,
  useUserWebsitesQuery,
  useWebsiteListChartsQuery,
} from '@/components/hooks';
import { Favicon } from '@/index';
import { decodePunycodeDomain } from '@/lib/format';
import { WebsiteSparkline } from '@/app/(main)/websites/WebsiteSparkline';
import { usePulseQuery } from './PulseShared';

function fmt(n: number | undefined) {
  return (n ?? 0).toLocaleString('en-US');
}

/** Websites home, recomposed: a Pulse summary strip (roll-up totals across
 *  all sites, last 30 days) followed by site cards with a 7-day visitor
 *  sparkline and key stats, instead of the plain stock table. */
export function PulseHomeSections({
  teamId,
  showActions,
}: {
  teamId?: string;
  showActions?: boolean;
}) {
  const { user } = useLoginQuery();
  const { renderUrl } = useNavigation();
  const { data: rollup } = usePulseQuery<any>('/pulse/rollup?days=30');

  const queryResult = useUserWebsitesQuery({ userId: user?.id, teamId }, { pageSize: 50 });
  const rows: any[] = (queryResult.data as any)?.data ?? [];
  const websiteIds = useMemo(() => rows.map(row => row.id), [rows]);
  const chartsQuery = useWebsiteListChartsQuery(websiteIds);
  const charts = (chartsQuery.data as any)?.data || {};

  const statsById = useMemo(() => {
    const map = new Map<string, any>();
    for (const site of rollup?.perSite || []) {
      map.set(site.websiteId, site);
    }
    return map;
  }, [rollup]);

  const totals = rollup?.totals;
  const statCards = totals
    ? [
        { label: 'Visitors', value: fmt(totals.visitors) },
        { label: 'Views', value: fmt(totals.pageviews) },
        { label: 'Visits', value: fmt(totals.visits) },
        { label: 'Bounce rate', value: `${totals.bounceRate}%` },
      ]
    : [];

  return (
    <Column gap="6">
      {totals && (
        <Column gap="3">
          <Row alignItems="baseline" gap="3">
            <span className="pulse-section-title">Pulse summary</span>
            <span className="pulse-meta">
              All sites · last 30 days · {(rollup?.perSite || []).length} sites
            </span>
          </Row>
          <div
            className="pulse-stagger"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: 'var(--pulse-space-block)',
            }}
          >
            {statCards.map(card => (
              <div key={card.label} className="pulse-card pulse-hover-lift">
                <div className="pulse-stat-value">{card.value}</div>
                <div className="pulse-stat-label">{card.label}</div>
              </div>
            ))}
          </div>
        </Column>
      )}

      <Column gap="3">
        <span className="pulse-section-title">Your sites</span>
        {queryResult.isLoading && (
          <Text color="muted">Loading sites…</Text>
        )}
        {!queryResult.isLoading && rows.length === 0 && (
          <Text color="muted">No websites yet. Add your first site to start measuring.</Text>
        )}
        <div
          className="pulse-stagger"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
            gap: 'var(--pulse-space-block)',
          }}
        >
          {rows.map(row => {
            const chart = charts[row.id];
            const stats = statsById.get(row.id);
            return (
              <div key={row.id} className="pulse-card pulse-hover-lift">
                <Row alignItems="center" gap="3" style={{ minWidth: 0 }}>
                  <span style={{ flexShrink: 0, display: 'inline-flex' }}>
                    <Favicon domain={row.domain} />
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <Link
                      href={renderUrl(`/websites/${row.id}`, false)}
                      style={{ fontWeight: 600, fontSize: 15 }}
                    >
                      {row.name}
                    </Link>
                    <span
                      className="pulse-meta"
                      style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                    >
                      {decodePunycodeDomain(row.domain)}
                    </span>
                  </span>
                  <span style={{ marginLeft: 'auto', flexShrink: 0 }}>
                    <WebsiteSparkline
                      values={chart?.values}
                      total={chart?.total}
                      isLoading={chartsQuery.isLoading && !chartsQuery.data}
                    />
                  </span>
                </Row>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: 8,
                    marginTop: 14,
                  }}
                >
                  {[
                    { label: 'Visitors', value: fmt(stats?.visitors) },
                    { label: 'Views', value: fmt(stats?.pageviews) },
                    { label: 'Visits', value: fmt(stats?.visits) },
                    {
                      label: 'Bounce',
                      value: stats ? `${Math.round(stats.bounceRate ?? 0)}%` : '—',
                    },
                  ].map(stat => (
                    <span key={stat.label}>
                      <span style={{ display: 'block', fontWeight: 600, fontSize: 15 }}>
                        {stat.value}
                      </span>
                      <span className="pulse-stat-label" style={{ fontSize: 11 }}>
                        {stat.label}
                      </span>
                    </span>
                  ))}
                </div>
                {showActions && (
                  <div style={{ marginTop: 12 }}>
                    <Link
                      href={renderUrl(`/settings/websites/${row.id}`, false)}
                      className="pulse-meta"
                    >
                      Site settings →
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Column>
    </Column>
  );
}
