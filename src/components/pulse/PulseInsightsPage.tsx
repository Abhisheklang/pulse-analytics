'use client';

import { Column, Text } from '@pulselytics/react-zen';
import { EmptyNote, PulseShell, Reveal, cardStyle, usePulseQuery } from './PulseShared';

export function PulseInsightsPage({ websiteId }: { websiteId: string }) {
  const { data, loading } = usePulseQuery<any>(`/pulse/websites/${websiteId}/insights?days=7`);
  const insights = data?.insights || [];

  return (
    <PulseShell
      title="Pulse Insights"
      subtitle="Deterministic, rule-based insights computed from this period versus the previous one. No AI, no external calls — just your data, explained."
    >
      {loading && !data ? (
        <EmptyNote>Computing insights…</EmptyNote>
      ) : insights.length === 0 ? (
        <EmptyNote>
          Not enough data yet for insights. Once this website has traffic in two consecutive periods,
          insights will appear here.
        </EmptyNote>
      ) : (
        <Column gap="3">
          {insights.map((insight: any, i: number) => (
            <Reveal key={i}>
              <Column gap="1" style={cardStyle}>
                <Text weight="bold" size="lg">
                  {insight.title}
                </Text>
                <Text color="muted">{insight.detail}</Text>
                <Text size="xs" color="muted">
                  {insight.type}
                </Text>
              </Column>
            </Reveal>
          ))}
        </Column>
      )}
    </PulseShell>
  );
}
