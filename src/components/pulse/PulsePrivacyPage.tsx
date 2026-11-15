'use client';

import { Column, Row, Text } from '@pulselytics/react-zen';
import { useState } from 'react';
import { useApi } from '@/components/hooks';
import { getClientAuthToken } from '@/lib/client';
import { getApiUrl } from '@/lib/api-url';
import {
  EmptyNote,
  Field,
  PulseShell,
  StatusMessage,
  dangerButtonStyle,
  formatDateTime,
  inputStyle,
  primaryButtonStyle,
  quietButtonStyle,
  tableStyle,
  tdStyle,
  thStyle,
  usePulseQuery,
  TableWrap,
} from './PulseShared';

export function PulsePrivacyPage({ websiteId }: { websiteId: string }) {
  const { put, post, get } = useApi();
  const { data, reload } = usePulseQuery<any>(`/pulse/websites/${websiteId}/privacy`);
  const { data: audit } = usePulseQuery<any>(`/pulse/websites/${websiteId}/privacy/audit`);
  const [retention, setRetention] = useState<string>('');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cleanupResult, setCleanupResult] = useState<any>(null);
  const [visitorId, setVisitorId] = useState('');
  const [visitor, setVisitor] = useState<any>(null);
  const [deleteResult, setDeleteResult] = useState<any>(null);

  const setting = data?.setting;

  const handleSaveRetention = async () => {
    setError(null);
    try {
      await put(`/pulse/websites/${websiteId}/privacy`, {
        retentionDays: Number(retention || setting?.retentionDays || 0),
      });
      setNotice('Retention setting saved.');
      reload();
    } catch (e: any) {
      setError(e?.message || 'Save failed');
    }
  };

  const handleCleanup = async () => {
    if (!window.confirm('Delete events and sessions older than the retention cutoff? This cannot be undone.')) {
      return;
    }
    setError(null);
    try {
      const result = await post(`/pulse/websites/${websiteId}/privacy/cleanup`, {});
      setCleanupResult(result);
      setNotice('Cleanup completed.');
      reload();
    } catch (e: any) {
      setError(e?.message || 'Cleanup failed');
    }
  };

  const handleExport = async (format: 'csv' | 'json') => {
    setError(null);
    try {
      const res = await fetch(
        getApiUrl(`/pulse/websites/${websiteId}/privacy/export?format=${format}`),
        { headers: { authorization: `Bearer ${getClientAuthToken()}` } },
      );
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pulse-export-${websiteId}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e?.message || 'Export failed');
    }
  };

  const handleVisitorLookup = async () => {
    setError(null);
    setDeleteResult(null);
    try {
      const result = await get(
        `/pulse/websites/${websiteId}/privacy/visitor?sessionId=${encodeURIComponent(visitorId.trim())}`,
      );
      setVisitor(result);
      if (!result.found) setNotice('No data stored for that session ID on this website.');
    } catch (e: any) {
      setError(e?.message || 'Lookup failed');
    }
  };

  const handleVisitorExport = async () => {
    setError(null);
    try {
      const res = await fetch(
        getApiUrl(
          `/pulse/websites/${websiteId}/privacy/visitor?sessionId=${encodeURIComponent(visitorId.trim())}&export=1`,
        ),
        { headers: { authorization: `Bearer ${getClientAuthToken()}` } },
      );
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pulse-visitor-${visitorId.trim()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e?.message || 'Export failed');
    }
  };

  const handleVisitorDelete = async () => {
    if (
      !window.confirm(
        'Permanently delete ALL data stored for this visitor (session + every event)? This cannot be undone.',
      )
    ) {
      return;
    }
    setError(null);
    try {
      const res = await fetch(
        getApiUrl(
          `/pulse/websites/${websiteId}/privacy/visitor?sessionId=${encodeURIComponent(visitorId.trim())}`,
        ),
        {
          method: 'DELETE',
          headers: { authorization: `Bearer ${getClientAuthToken()}` },
        },
      );
      if (!res.ok) throw new Error(`Delete failed (${res.status})`);
      const result = await res.json();
      setDeleteResult(result);
      setVisitor(null);
      setNotice('Visitor data deleted.');
      reload();
    } catch (e: any) {
      setError(e?.message || 'Delete failed');
    }
  };

  return (
    <PulseShell
      title="Privacy & Retention"
      subtitle="Control how long this website keeps its raw analytics data, run a cleanup, export events, and answer visitor data requests (lookup, export, erasure)."
    >
      <StatusMessage error={error} notice={notice} />

      <Column gap="3">
        <Text size="4" weight="bold">
          Current data
        </Text>
        <Text>
          {data
            ? `${data.eventCount} events · ${data.sessionCount} sessions · from ${formatDateTime(data.dataRange?.from)} to ${formatDateTime(data.dataRange?.to)}`
            : 'Loading…'}
        </Text>
      </Column>

      <Column gap="3">
        <Text size="4" weight="bold">
          Retention
        </Text>
        <Row gap="3" wrap="wrap" alignItems="flex-end">
          <Field label="Retention days (0 = keep forever)">
            <input
              style={{ ...inputStyle, minWidth: 120 }}
              type="number"
              min={0}
              placeholder={setting ? String(setting.retentionDays) : '0'}
              value={retention}
              onChange={e => setRetention(e.target.value)}
            />
          </Field>
          <button style={primaryButtonStyle} onClick={handleSaveRetention}>
            Save retention
          </button>
          <button style={quietButtonStyle} onClick={handleCleanup}>
            Run cleanup now
          </button>
        </Row>
        <Text size="2" color="muted">
          Current setting: {setting ? `${setting.retentionDays} days` : '…'} · Cleanup deletes events (and
          orphaned sessions) older than the cutoff for this website only.
        </Text>
        {cleanupResult && (
          <Text>
            Last cleanup (cutoff {formatDateTime(cleanupResult.cutoff)}): deleted{' '}
            {cleanupResult.eventsDeleted} events, {cleanupResult.eventDataDeleted} event-data rows,{' '}
            {cleanupResult.sessionsDeleted} sessions.
          </Text>
        )}
      </Column>

      <Column gap="3">
        <Text size="4" weight="bold">
          Export events
        </Text>
        <Row gap="3">
          <button style={quietButtonStyle} onClick={() => handleExport('csv')}>
            Download CSV
          </button>
          <button style={quietButtonStyle} onClick={() => handleExport('json')}>
            Download JSON
          </button>
        </Row>
        <Text size="2" color="muted">
          Exports up to 50,000 events for this website (all dates, or use the API with startAt/endAt
          parameters for a specific range).
        </Text>
      </Column>

      <Column gap="3">
        <Text size="4" weight="bold">
          Visitor data (GDPR toolkit)
        </Text>
        <Text size="2" color="muted">
          Look up everything stored for one visitor by their session ID — for data access and
          erasure requests. You can find session IDs on the Sessions page.
        </Text>
        <Row gap="3" wrap="wrap" alignItems="flex-end">
          <Field label="Session ID">
            <input
              style={{ ...inputStyle, minWidth: 320 }}
              value={visitorId}
              onChange={e => setVisitorId(e.target.value)}
              placeholder="00000000-0000-0000-0000-000000000000"
            />
          </Field>
          <button style={primaryButtonStyle} onClick={handleVisitorLookup}>
            Look up visitor
          </button>
          {visitor?.found && (
            <>
              <button style={quietButtonStyle} onClick={handleVisitorExport}>
                Export JSON
              </button>
              <button style={dangerButtonStyle} onClick={handleVisitorDelete}>
                Delete visitor data
              </button>
            </>
          )}
        </Row>
        {deleteResult && (
          <Text>
            Deleted: {deleteResult.eventsDeleted} events, {deleteResult.eventDataDeleted}{' '}
            event-data rows, {deleteResult.sessionDataDeleted} session-data rows,{' '}
            {deleteResult.sessionsDeleted} session.
          </Text>
        )}
        {visitor?.found && (
          <Column gap="2">
            <Text>
              Session: {visitor.session.browser || '-'} · {visitor.session.os || '-'} ·{' '}
              {visitor.session.device || '-'} · {visitor.session.country || '-'} · screen{' '}
              {visitor.session.screen || '-'} · language {visitor.session.language || '-'} · first
              seen {formatDateTime(visitor.session.createdAt)} · {visitor.events.length} events
            </Text>
            <TableWrap><table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Time</th>
                  <th style={thStyle}>Page / event</th>
                  <th style={thStyle}>Referrer</th>
                  <th style={thStyle}>Data</th>
                </tr>
              </thead>
              <tbody>
                {visitor.events.slice(0, 50).map((e: any) => (
                  <tr key={e.id}>
                    <td style={tdStyle}>{formatDateTime(e.createdAt)}</td>
                    <td style={tdStyle}>
                      {e.eventName ? `${e.eventName} · ` : ''}
                      {e.urlPath}
                    </td>
                    <td style={tdStyle}>{e.referrerDomain || '—'}</td>
                    <td style={{ ...tdStyle, wordBreak: 'break-all', maxWidth: 320 }}>
                      {e.data && Object.keys(e.data).length ? JSON.stringify(e.data) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></TableWrap>
          </Column>
        )}
      </Column>

      <Column gap="3">
        <Text size="4" weight="bold">
          Privacy audit — what Pulse stores
        </Text>
        {!audit ? (
          <EmptyNote>Loading audit…</EmptyNote>
        ) : (
          <>
            <Row gap="3" wrap="wrap">
              <Text>
                Raw IP addresses stored: <b>{audit.rawIpStored ? 'Yes' : 'No'}</b>
              </Text>
              <Text>
                Cookies used: <b>{audit.cookiesUsed ? 'Yes' : 'None'}</b>
              </Text>
              <Text>
                Retention: <b>{audit.retentionDays > 0 ? `${audit.retentionDays} days` : 'Keep forever'}</b>
              </Text>
            </Row>
            <Text size="2" color="muted">
              {audit.rawIpNote}
            </Text>
            <Text size="2" color="muted">
              {audit.cookiesNote}
            </Text>
            <TableWrap><table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Field</th>
                  <th style={thStyle}>Stored in</th>
                  <th style={thStyle}>Note</th>
                </tr>
              </thead>
              <tbody>
                {audit.storedPerVisitor.map((f: any) => (
                  <tr key={f.field}>
                    <td style={tdStyle}>{f.field}</td>
                    <td style={tdStyle}>{f.source}</td>
                    <td style={tdStyle}>{f.note}</td>
                  </tr>
                ))}
              </tbody>
            </table></TableWrap>
          </>
        )}
      </Column>
    </PulseShell>
  );
}
