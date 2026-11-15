'use client';

import { Column, Row } from '@pulselytics/react-zen';
import Link from '@/components/common/Link';
import { useNavigation } from '@/components/hooks';
import { usePulseQuery } from './PulseShared';

/** Website overview lead-in: the top Pulse insight headlines for the last
 *  7 days as cards, ahead of the traffic chart. */
export function PulseInsightsStrip({ websiteId }: { websiteId: string }) {
  const { renderUrl } = useNavigation();
  const { data } = usePulseQuery<any>(`/pulse/websites/${websiteId}/insights?days=7`);
  const insights = (data?.insights || []).slice(0, 3);

  if (!data) {
    return null;
  }

  return (
    <Column gap="3" style={{ width: '100%' }}>
      <Row alignItems="baseline" gap="3">
        <span className="pulse-section-title">Pulse insights</span>
        <span className="pulse-meta">Last 7 days</span>
        <Link
          href={renderUrl(`/websites/${websiteId}/pulse/insights`, false)}
          className="pulse-meta"
          style={{ marginLeft: 'auto' }}
        >
          View all insights →
        </Link>
      </Row>
      {insights.length === 0 ? (
        <div className="pulse-card">
          <span className="pulse-meta">
            No insights yet — Pulse needs a few days of traffic before patterns stand out.
          </span>
        </div>
      ) : (
        <div
          className="pulse-stagger"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 'var(--pulse-space-block)',
          }}
        >
          {insights.map((insight: any, index: number) => (
            <div key={`${insight.type}-${index}`} className="pulse-card pulse-hover-lift">
              <div style={{ fontWeight: 600, fontSize: 15, lineHeight: 1.35 }}>
                {insight.title}
              </div>
              {insight.detail && (
                <div className="pulse-meta" style={{ marginTop: 6, lineHeight: 1.45 }}>
                  {insight.detail}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Column>
  );
}
