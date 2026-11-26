'use client';

import { Column, Row, Text } from '@pulselytics/react-zen';
import { useState } from 'react';
import Link from '@/components/common/Link';
import { useApi } from '@/components/hooks';
import {
  PulseShell,
  StatusChip,
  StatusMessage,
  cardStyle,
  primaryButtonStyle,
  quietButtonStyle,
  usePulseQuery,
} from './PulseShared';

const STEP_HINTS: Record<string, string> = {
  password: 'The seeded admin account ships with a well-known default password. Change it first.',
  website: 'Websites are the properties you track. Create one for each domain.',
  snippet:
    'Paste the snippet into your site’s <head>. The optional add-ons enable Web Vitals and A/B testing.',
  data: 'As soon as the snippet loads on a page, data appears here — usually within seconds.',
  badge: 'Optional: show a live "visitors today" badge on your site from the Badge & Webhooks page.',
};

export function PulseOnboardingPage() {
  const { put } = useApi();
  const { data, error, reload } = usePulseQuery<any>('/pulse/onboarding');
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const websiteId = data?.websiteId;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  const snippet = websiteId
    ? [
        `<script async src="${origin}/script.js" data-website-id="${websiteId}"></script>`,
        `<!-- Optional add-ons -->`,
        `<script async src="${origin}/pulse-vitals.js"></script>`,
        `<script async src="${origin}/pulse-ab.js"></script>`,
      ].join('\n')
    : '';

  const mark = async (patch: Record<string, boolean>, message: string) => {
    setActionError(null);
    try {
      await put('/pulse/onboarding', patch);
      setNotice(message);
      await reload();
    } catch (e: any) {
      setActionError(e?.message || 'Update failed');
    }
  };

  const copySnippet = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setActionError('Copy failed — select the snippet text and copy it manually.');
    }
  };

  const steps = data?.steps || [];

  return (
    <PulseShell
      title="Getting started"
      subtitle="Set up Pulse Analytics in a few steps. Progress is detected automatically from your account — no forms to file."
      action={
        data && !data.dismissed ? (
          <button
            style={quietButtonStyle}
            onClick={() => mark({ dismissed: true }, 'Getting started dismissed.')}
          >
            Dismiss
          </button>
        ) : undefined
      }
    >
      <StatusMessage error={error || actionError} notice={notice} />

      {data && (
        <Text size="base" color="muted">
          {data.complete
            ? 'All required steps are complete — Pulse is collecting data.'
            : `${data.completed} of ${data.total} required steps complete.`}
        </Text>
      )}

      <Column gap="3">
        {steps.map((step: any, i: number) => (
          <div key={step.key} style={cardStyle}>
            <Column gap="2">
              <Row gap="3" alignItems="center" wrap="wrap">
                <Text weight="bold">
                  {i + 1}. {step.label}
                </Text>
                {step.optional && <StatusChip tone="neutral">Optional</StatusChip>}
                <StatusChip tone={step.done ? 'success' : 'warning'}>
                  {step.done ? 'Done' : 'Pending'}
                </StatusChip>
              </Row>
              <Text size="sm" color="muted">
                {STEP_HINTS[step.key]}
              </Text>

              {step.key === 'password' && !step.done && (
                <Row gap="3" wrap="wrap">
                  <Link href="/settings/profile">
                    <button style={primaryButtonStyle}>Change password</button>
                  </Link>
                  <button
                    style={quietButtonStyle}
                    onClick={() => mark({ passwordChanged: true }, 'Password step marked done.')}
                  >
                    I already changed it
                  </button>
                </Row>
              )}

              {step.key === 'website' && !step.done && (
                <Row>
                  <Link href="/websites">
                    <button style={primaryButtonStyle}>Create a website</button>
                  </Link>
                </Row>
              )}

              {step.key === 'snippet' && websiteId && (
                <Column gap="2">
                  <pre
                    style={{
                      background: 'var(--zen-surface-raised, #f4f4f8)',
                      border: '1px solid var(--zen-border, #e2e2ea)',
                      borderRadius: 'var(--pulse-radius-control)',
                      padding: 12,
                      fontSize: 12.5,
                      overflowX: 'auto',
                      margin: 0,
                    }}
                  >
                    {snippet}
                  </pre>
                  <Row gap="3" wrap="wrap">
                    <button style={quietButtonStyle} onClick={copySnippet}>
                      {copied ? 'Copied!' : 'Copy snippet'}
                    </button>
                    {!step.done && (
                      <button
                        style={quietButtonStyle}
                        onClick={() =>
                          mark({ snippetConfirmed: true }, 'Snippet step marked done.')
                        }
                      >
                        Mark as installed
                      </button>
                    )}
                  </Row>
                </Column>
              )}

              {step.key === 'badge' && !step.done && websiteId && (
                <Row>
                  <Link href={`/websites/${websiteId}/pulse/badge`}>
                    <button style={quietButtonStyle}>Open Badge &amp; Webhooks</button>
                  </Link>
                </Row>
              )}
            </Column>
          </div>
        ))}
      </Column>
    </PulseShell>
  );
}
