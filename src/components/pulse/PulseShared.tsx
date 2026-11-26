'use client';

import { Column, Row, Text } from '@pulselytics/react-zen';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useApi } from '@/components/hooks';
import { isMotionOff } from '@/components/hooks/usePulseMotion';

// ---- Pulse design system (wave 4 polish, radius/motion wave) ----
// One shared style language for every Pulse page, built on the app's theme
// tokens (Midnight Pulse: indigo primary) so Pulse pages match the rest of
// the product in light and dark mode. Radii come from the design tokens in
// global.css (--pulse-radius-control for controls, --pulse-radius-card for
// cards, --pulse-radius-pill for chips) so one token change lifts every
// Pulse page at once.

const BORDER = 'var(--zen-border, #d9dae6)';
const SURFACE = 'var(--zen-surface, #fff)';
const PRIMARY = 'var(--zen-primary, #4f46e5)';
const RADIUS_CONTROL = 'var(--pulse-radius-control, 12px)';
const RADIUS_CARD = 'var(--pulse-radius-card, 20px)';

export const inputStyle: React.CSSProperties = {
  padding: '8px 10px',
  border: `1px solid ${BORDER}`,
  borderRadius: RADIUS_CONTROL,
  fontSize: 14,
  minWidth: 180,
  maxWidth: '100%',
  boxSizing: 'border-box',
  background: SURFACE,
  color: 'inherit',
};

export const primaryButtonStyle: React.CSSProperties = {
  padding: '8px 16px',
  borderRadius: RADIUS_CONTROL,
  border: 'none',
  background: PRIMARY,
  color: 'var(--zen-primary-fg, #fff)',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

export const quietButtonStyle: React.CSSProperties = {
  padding: '8px 14px',
  borderRadius: RADIUS_CONTROL,
  border: `1px solid ${BORDER}`,
  background: 'transparent',
  color: 'inherit',
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

export const dangerButtonStyle: React.CSSProperties = {
  ...quietButtonStyle,
  borderColor: 'var(--zen-status-error, #e5a3a3)',
  color: 'var(--zen-status-error, #b91c1c)',
};

export const cardStyle: React.CSSProperties = {
  border: `1px solid ${BORDER}`,
  borderRadius: RADIUS_CARD,
  padding: 20,
  background: SURFACE,
};

export const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 14,
};

export const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 10px',
  borderBottom: `2px solid ${BORDER}`,
  fontWeight: 600,
  fontSize: 13,
  whiteSpace: 'nowrap',
};

export const tdStyle: React.CSSProperties = {
  padding: '8px 10px',
  borderBottom: '1px solid var(--zen-border, #eeeef4)',
  verticalAlign: 'top',
};

export const numThStyle: React.CSSProperties = { ...thStyle, textAlign: 'right' };
export const numTdStyle: React.CSSProperties = { ...tdStyle, textAlign: 'right' };

// Wraps a table so wide tables scroll inside their card on narrow screens
// instead of pushing the whole page sideways.
export function TableWrap({ children }: { children: ReactNode }) {
  return (
    <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
      <div style={{ minWidth: 520 }}>{children}</div>
    </div>
  );
}

/** Scroll reveal wrapper: sections below the fold fade + rise into view.
 *  Safety first — the element renders fully visible by default; only after
 *  mount, and only when an IntersectionObserver exists, motion is allowed
 *  and the element starts below the viewport, do we add the hidden start
 *  state (.pulse-reveal-init) and swap it out when it scrolls into view.
 *  No JS, no IO, reduced motion, or animations switched off in Settings
 *  ⇒ content is simply there. */
export function Reveal({
  children,
  style,
}: {
  children: ReactNode;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') return;
    if (isMotionOff()) return;
    // Already in (or near) the viewport: nothing to reveal.
    if (el.getBoundingClientRect().top < window.innerHeight) return;

    el.classList.add('pulse-reveal-init');
    const io = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            el.classList.remove('pulse-reveal-init');
            io.disconnect();
          }
        }
      },
      { threshold: 0.05, rootMargin: '0px 0px -32px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className="pulse-reveal" style={style}>
      {children}
    </div>
  );
}

export type ChipTone = 'success' | 'danger' | 'warning' | 'neutral' | 'info';

const CHIP_TONES: Record<ChipTone, React.CSSProperties> = {
  success: {
    background: 'var(--zen-status-success-bg, #e7f6ec)',
    color: 'var(--zen-status-success, #15803d)',
  },
  danger: {
    background: 'var(--zen-status-error-bg, #fdecec)',
    color: 'var(--zen-status-error, #b91c1c)',
  },
  warning: { background: '#fdf3e0', color: '#9a6a00' },
  neutral: { background: 'var(--zen-surface-raised, #f0f0f5)', color: 'inherit' },
  info: { background: '#eef2ff', color: PRIMARY },
};

export function StatusChip({ tone, children }: { tone: ChipTone; children: ReactNode }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 10px',
        borderRadius: 'var(--pulse-radius-pill, 999px)',
        fontSize: 12,
        fontWeight: 600,
        lineHeight: 1.6,
        whiteSpace: 'nowrap',
        ...CHIP_TONES[tone],
      }}
    >
      {children}
    </span>
  );
}

export function usePulseQuery<T>(url: string | null) {
  const { get } = useApi();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!url) return;
    setLoading(true);
    setError(null);
    try {
      const result = await get(url);
      setData(result as T);
    } catch (e: any) {
      setError(e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [url, get]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, loading, error, reload };
}

export function PulseShell({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Column
      gap="5"
      padding="6"
      maxWidth="1200px"
      className="pulse-page"
      style={{ width: '100%', boxSizing: 'border-box' }}
    >
      <Row justifyContent="space-between" alignItems="flex-start" gap="3" wrap="wrap">
        <Column gap="1">
          <Text size="2xl" weight="bold">
            {title}
          </Text>
          {subtitle && (
            <Text color="muted" size="base">
              {subtitle}
            </Text>
          )}
        </Column>
        {action}
      </Row>
      {children}
    </Column>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <Column gap="1">
      <Text size="sm" weight="bold">
        {label}
      </Text>
      {children}
    </Column>
  );
}

export function StatusMessage({ error, notice }: { error?: string | null; notice?: string | null }) {
  return (
    <>
      {error && (
        <Row
          padding="3"
          style={{
            background: 'var(--zen-status-error-bg, #fef2f2)',
            border: '1px solid var(--zen-status-error, #e5a3a3)',
            borderRadius: RADIUS_CONTROL,
          }}
        >
          <Text style={{ color: 'var(--zen-status-error, #b91c1c)' }}>{error}</Text>
        </Row>
      )}
      {notice && (
        <Row
          padding="3"
          style={{ background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: RADIUS_CONTROL }}
        >
          <Text>{notice}</Text>
        </Row>
      )}
    </>
  );
}

export interface ChannelFormState {
  channel: string;
  webhookUrl: string;
  telegramBotToken: string;
  telegramChatId: string;
  emailTo: string;
}

export const emptyChannelForm: ChannelFormState = {
  channel: 'webhook',
  webhookUrl: '',
  telegramBotToken: '',
  telegramChatId: '',
  emailTo: '',
};

export function channelPayload(form: ChannelFormState) {
  return {
    channel: form.channel,
    webhookUrl:
      form.channel === 'telegram' || form.channel === 'email'
        ? undefined
        : form.webhookUrl || undefined,
    telegramBotToken: form.channel === 'telegram' ? form.telegramBotToken || undefined : undefined,
    telegramChatId: form.channel === 'telegram' ? form.telegramChatId || undefined : undefined,
    emailTo: form.emailTo || undefined,
  };
}

export function channelTargetText(item: any): string {
  const channel = item?.channel || 'webhook';
  if (channel === 'telegram') return `Telegram · chat ${item?.telegramChatId || '?'}`;
  if (channel === 'email') return `Email · ${item?.emailTo || item?.email || '?'}`;
  const url = item?.webhookUrl || '-';
  return `${channel} · ${url}`;
}

export function ChannelFields({
  value,
  onChange,
}: {
  value: ChannelFormState;
  onChange: (next: ChannelFormState) => void;
}) {
  const set = (patch: Partial<ChannelFormState>) => onChange({ ...value, ...patch });

  return (
    <>
      <Field label="Channel">
        <select
          style={inputStyle}
          value={value.channel}
          onChange={e => set({ channel: e.target.value })}
        >
          <option value="webhook">Generic webhook</option>
          <option value="slack">Slack</option>
          <option value="discord">Discord</option>
          <option value="telegram">Telegram</option>
          <option value="email">Email</option>
        </select>
      </Field>
      {value.channel === 'telegram' ? (
        <>
          <Field label="Bot token">
            <input
              style={{ ...inputStyle, minWidth: 220 }}
              value={value.telegramBotToken}
              onChange={e => set({ telegramBotToken: e.target.value })}
              placeholder="123456:ABC-DEF…"
            />
          </Field>
          <Field label="Chat ID">
            <input
              style={{ ...inputStyle, minWidth: 140 }}
              value={value.telegramChatId}
              onChange={e => set({ telegramChatId: e.target.value })}
              placeholder="-1001234567890"
            />
          </Field>
        </>
      ) : value.channel === 'email' ? (
        <Field label="Email recipient">
          <input
            style={{ ...inputStyle, minWidth: 260 }}
            value={value.emailTo}
            onChange={e => set({ emailTo: e.target.value })}
            placeholder="alerts@example.com"
          />
        </Field>
      ) : (
        <Field
          label={
            value.channel === 'slack'
              ? 'Slack webhook URL'
              : value.channel === 'discord'
                ? 'Discord webhook URL'
                : 'Webhook URL'
          }
        >
          <input
            style={{ ...inputStyle, minWidth: 260 }}
            value={value.webhookUrl}
            onChange={e => set({ webhookUrl: e.target.value })}
            placeholder={
              value.channel === 'slack'
                ? 'https://hooks.slack.com/services/…'
                : value.channel === 'discord'
                  ? 'https://discord.com/api/webhooks/…'
                  : 'https://example.com/hook'
            }
          />
        </Field>
      )}
      {value.channel !== 'email' && (
        <Field label="Also email (optional)">
          <input
            style={{ ...inputStyle, minWidth: 220 }}
            value={value.emailTo}
            onChange={e => set({ emailTo: e.target.value })}
            placeholder="alerts@example.com"
          />
        </Field>
      )}
    </>
  );
}

export function formatDateTime(value?: string | null): string {
  if (!value) return '-';
  const d = new Date(value);
  return isNaN(d.getTime()) ? '-' : d.toLocaleString();
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <Row
      padding="5"
      justifyContent="center"
      style={{
        border: `1px dashed ${BORDER}`,
        borderRadius: RADIUS_CARD,
        background: 'var(--zen-surface-raised, #fafafc)',
      }}
    >
      <Text color="muted">{children}</Text>
    </Row>
  );
}
