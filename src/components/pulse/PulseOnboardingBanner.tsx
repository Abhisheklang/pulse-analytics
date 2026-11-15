'use client';

import { Row, Text } from '@pulselytics/react-zen';
import Link from '@/components/common/Link';
import { useApi } from '@/components/hooks';
import { primaryButtonStyle, quietButtonStyle, usePulseQuery } from './PulseShared';

// Dismissible "Getting started" banner for the websites dashboard. Shown
// only while the account's onboarding is incomplete and not dismissed.
export function PulseOnboardingBanner() {
  const { put } = useApi();
  const { data, reload } = usePulseQuery<any>('/pulse/onboarding');

  if (!data || data.dismissed || data.complete) return null;

  const dismiss = async () => {
    await put('/pulse/onboarding', { dismissed: true });
    await reload();
  };

  return (
    <Row
      gap="3"
      alignItems="center"
      wrap="wrap"
      style={{
        border: '1px solid var(--zen-primary, #4f46e5)',
        background: '#eef2ff',
        borderRadius: 'var(--pulse-radius-card)',
        padding: '12px 16px',
      }}
    >
      <Text weight="bold">Getting started with Pulse</Text>
      <Text color="muted">
        {data.completed} of {data.total} setup steps complete — finish setting up to get the most
        out of your analytics.
      </Text>
      <Link href="/pulse/getting-started">
        <button style={primaryButtonStyle}>Continue setup</button>
      </Link>
      <button style={quietButtonStyle} onClick={dismiss}>
        Dismiss
      </button>
    </Row>
  );
}
