'use client';

import { Column, Row, Text } from '@pulselytics/react-zen';
import { useEffect, useState } from 'react';
import { useApi } from '@/components/hooks';
import {
  EmptyNote,
  Field,
  PulseShell,
  StatusChip,
  StatusMessage,
  TableWrap,
  formatDateTime,
  inputStyle,
  primaryButtonStyle,
  quietButtonStyle,
  tableStyle,
  tdStyle,
  thStyle,
  usePulseQuery,
} from './PulseShared';

const JOB_LABELS: Record<string, string> = {
  alerts: 'Alert evaluation',
  reports: 'Scheduled reports',
  uptime: 'Uptime checks',
  retention: 'Retention cleanup',
};

function intervalText(job: string, intervalMs: number) {
  if (job === 'uptime') return 'per monitor';
  const minutes = Math.round(intervalMs / 60000);
  if (minutes >= 60) return `every ${Math.round(minutes / 60)} h`;
  return `every ${minutes} min`;
}

export function PulseSchedulerPage() {
  const { put, post } = useApi();
  const { data, error, reload } = usePulseQuery<any>('/pulse/scheduler');
  const [form, setForm] = useState<any>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState('');

  useEffect(() => {
    if (data?.config && !form) setForm(data.config);
  }, [data, form]);

  const save = async () => {
    setBusy('save');
    setActionError(null);
    try {
      await put('/pulse/scheduler', {
        enabled: !!form.enabled,
        alertsIntervalMinutes: Number(form.alertsIntervalMinutes),
        reportsIntervalMinutes: Number(form.reportsIntervalMinutes),
        retentionIntervalHours: Number(form.retentionIntervalHours),
      });
      setNotice('Scheduler settings saved.');
      await reload();
    } catch (e: any) {
      setActionError(e?.message || 'Save failed');
    } finally {
      setBusy('');
    }
  };

  const runNow = async (job: string) => {
    setBusy(job);
    setActionError(null);
    try {
      const res: any = await post('/pulse/scheduler', { job });
      setNotice(`${JOB_LABELS[job]} ran: ${res?.result?.detail || 'done'}`);
      await reload();
    } catch (e: any) {
      setActionError(e?.message || 'Run failed');
    } finally {
      setBusy('');
    }
  };

  const jobs = data?.jobs || [];
  const logs = data?.logs || [];

  return (
    <PulseShell
      title="Scheduler"
      subtitle="Pulse's built-in scheduler runs alert evaluation, due scheduled reports, uptime checks and retention cleanup inside the server — no external cron needed. The /api/pulse/cron endpoints remain available as manual fallbacks."
    >
      <StatusMessage error={error || actionError} notice={notice} />

      {form && (
        <Column gap="3">
          <Row gap="4" wrap="wrap" alignItems="flex-end">
            <Field label="Scheduler">
              <select
                style={inputStyle}
                value={form.enabled ? 'on' : 'off'}
                onChange={e => setForm({ ...form, enabled: e.target.value === 'on' })}
              >
                <option value="on">Enabled</option>
                <option value="off">Disabled</option>
              </select>
            </Field>
            <Field label="Alerts interval (minutes)">
              <input
                style={{ ...inputStyle, minWidth: 120 }}
                type="number"
                min={1}
                value={form.alertsIntervalMinutes}
                onChange={e => setForm({ ...form, alertsIntervalMinutes: e.target.value })}
              />
            </Field>
            <Field label="Reports check (minutes)">
              <input
                style={{ ...inputStyle, minWidth: 120 }}
                type="number"
                min={1}
                value={form.reportsIntervalMinutes}
                onChange={e => setForm({ ...form, reportsIntervalMinutes: e.target.value })}
              />
            </Field>
            <Field label="Retention interval (hours)">
              <input
                style={{ ...inputStyle, minWidth: 120 }}
                type="number"
                min={1}
                value={form.retentionIntervalHours}
                onChange={e => setForm({ ...form, retentionIntervalHours: e.target.value })}
              />
            </Field>
            <button style={primaryButtonStyle} onClick={save} disabled={busy === 'save'}>
              {busy === 'save' ? 'Saving…' : 'Save settings'}
            </button>
          </Row>
          <Text size="sm" color="muted">
            Status: {data?.config?.enabled ? 'enabled' : 'disabled'} · this server instance{' '}
            {data?.instanceId || ''}
          </Text>
        </Column>
      )}

      <Column gap="2">
        <Text size="base" weight="bold">
          Jobs
        </Text>
        {jobs.length === 0 ? (
          <EmptyNote>No scheduler data yet — the scheduler starts with the server.</EmptyNote>
        ) : (
          <TableWrap>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Job</th>
                  <th style={thStyle}>Interval</th>
                  <th style={thStyle}>Last run</th>
                  <th style={thStyle}>Next due</th>
                  <th style={thStyle}>Last result</th>
                  <th style={thStyle}></th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j: any) => (
                  <tr key={j.job}>
                    <td style={tdStyle}>{JOB_LABELS[j.job] || j.job}</td>
                    <td style={tdStyle}>{intervalText(j.job, j.intervalMs)}</td>
                    <td style={tdStyle}>{formatDateTime(j.lastRunAt)}</td>
                    <td style={tdStyle}>{formatDateTime(j.nextDueAt)}</td>
                    <td style={tdStyle}>{j.lastResult || '-'}</td>
                    <td style={tdStyle}>
                      <button
                        style={quietButtonStyle}
                        onClick={() => runNow(j.job)}
                        disabled={busy === j.job}
                      >
                        {busy === j.job ? 'Running…' : 'Run now'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Column>

      <Column gap="2">
        <Text size="base" weight="bold">
          Run history
        </Text>
        {logs.length === 0 ? (
          <EmptyNote>No runs recorded yet.</EmptyNote>
        ) : (
          <TableWrap>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>When</th>
                  <th style={thStyle}>Job</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Items</th>
                  <th style={thStyle}>Detail</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l: any) => (
                  <tr key={l.id}>
                    <td style={tdStyle}>{formatDateTime(l.createdAt)}</td>
                    <td style={tdStyle}>{JOB_LABELS[l.job] || l.job}</td>
                    <td style={tdStyle}>
                      <StatusChip tone={l.ok ? 'success' : 'danger'}>
                        {l.ok ? 'OK' : 'Failed'}
                      </StatusChip>
                    </td>
                    <td style={tdStyle}>{l.items}</td>
                    <td style={tdStyle}>{l.detail || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Column>
    </PulseShell>
  );
}
