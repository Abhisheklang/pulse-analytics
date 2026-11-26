'use client';

import { Column, Row, Text } from '@pulselytics/react-zen';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useApi } from '@/components/hooks';
import {
  EmptyNote,
  PulseShell,
  StatusMessage,
  formatDateTime,
  inputStyle,
  primaryButtonStyle,
  quietButtonStyle,
  tableStyle,
  tdStyle,
  thStyle,
  TableWrap,
} from './PulseShared';

export function PulseDebuggerPage({ websiteId }: { websiteId: string }) {
  const { get } = useApi();
  const [events, setEvents] = useState<any[]>([]);
  const [paused, setPaused] = useState(false);
  const [filter, setFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const filterRef = useRef(filter);
  filterRef.current = filter;

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (filterRef.current.trim()) params.set('filter', filterRef.current.trim());
      const res = await get(`/pulse/websites/${websiteId}/events/live?${params.toString()}`);
      setEvents(res.events || []);
      setLastUpdated(new Date());
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Failed to load events');
    }
  }, [websiteId, get]);

  useEffect(() => {
    load();
    const timer = setInterval(() => {
      if (!pausedRef.current) load();
    }, 3000);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    const t = setTimeout(load, 400);
    return () => clearTimeout(t);
  }, [filter, load]);

  const handleSendTest = async () => {
    const marker = `debug-${Date.now()}`;
    try {
      const res = await fetch('/api/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          type: 'event',
          payload: {
            website: websiteId,
            url: 'https://example.com/debugger',
            hostname: 'example.com',
            referrer: '',
            name: 'pulse.debug',
            data: { marker, source: 'pulse-debugger' },
          },
        }),
      });
      if (!res.ok) throw new Error(`Send failed with HTTP ${res.status}`);
      setNotice(`Test event sent (marker ${marker}). It should appear at the top of the feed within a few seconds.`);
      setTimeout(load, 700);
    } catch (e: any) {
      setError(e?.message || 'Failed to send test event');
    }
  };

  return (
    <PulseShell
      title="Live Event Debugger"
      subtitle="The newest events arriving for this website, refreshed every 3 seconds. Send a test event and watch it land here to verify collection end-to-end."
    >
      <StatusMessage error={error} notice={notice} />

      <Row gap="3" alignItems="center" wrap="wrap">
        <button style={primaryButtonStyle} onClick={handleSendTest}>
          Send test event
        </button>
        <button style={quietButtonStyle} onClick={() => setPaused(!paused)}>
          {paused ? '▶ Resume live refresh' : '⏸ Pause'}
        </button>
        <input
          style={{ ...inputStyle, minWidth: 240 }}
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Filter by event name or path…"
        />
        <Text size="sm" color="muted">
          {paused
            ? 'Paused'
            : `Live · last updated ${lastUpdated ? lastUpdated.toLocaleTimeString() : '…'}`}
          {' · '}
          {events.length} events shown
        </Text>
      </Row>

      {events.length === 0 ? (
        <EmptyNote>
          No events match. Send a test event, or check the filter.
        </EmptyNote>
      ) : (
        <TableWrap><table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Time</th>
              <th style={thStyle}>Type</th>
              <th style={thStyle}>Path / event</th>
              <th style={thStyle}>Referrer</th>
              <th style={thStyle}>Country</th>
              <th style={thStyle}>Browser</th>
              <th style={thStyle}>Data</th>
            </tr>
          </thead>
          <tbody>
            {events.map(ev => (
              <tr key={ev.id} style={{ verticalAlign: 'top' }}>
                <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{formatDateTime(ev.createdAt)}</td>
                <td style={tdStyle}>{ev.type}</td>
                <td style={tdStyle}>
                  {ev.urlPath}
                  {ev.eventName && (
                    <>
                      {' '}
                      <span
                        style={{
                          padding: '1px 8px',
                          borderRadius: 999,
                          background: '#e0e7ff',
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        {ev.eventName}
                      </span>
                    </>
                  )}
                </td>
                <td style={tdStyle}>{ev.referrerDomain || '(direct)'}</td>
                <td style={tdStyle}>{ev.country || '—'}</td>
                <td style={tdStyle}>{ev.browser || '—'}</td>
                <td style={tdStyle}>
                  {ev.data && Object.keys(ev.data).length ? (
                    expandedId === ev.id ? (
                      <span>
                        <button style={quietButtonStyle} onClick={() => setExpandedId(null)}>
                          Hide
                        </button>
                        <pre
                          style={{
                            margin: '6px 0 0',
                            fontSize: 12,
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                          }}
                        >
                          {JSON.stringify(ev.data, null, 2)}
                        </pre>
                      </span>
                    ) : (
                      <button style={quietButtonStyle} onClick={() => setExpandedId(ev.id)}>
                        View data
                      </button>
                    )
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table></TableWrap>
      )}
    </PulseShell>
  );
}
