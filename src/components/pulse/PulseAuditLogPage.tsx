'use client';

import { Column, Row, Text } from '@pulselytics/react-zen';
import { useState } from 'react';
import {
  EmptyNote,
  PulseShell,
  StatusMessage,
  formatDateTime,
  inputStyle,
  tableStyle,
  tdStyle,
  thStyle,
  usePulseQuery,
  TableWrap,
} from './PulseShared';

const ACTION_LABELS: Record<string, string> = {
  visitor_delete: 'Visitor data deleted',
  retention_cleanup: 'Retention cleanup',
  csv_import: 'CSV import',
  warehouse_export: 'Warehouse export',
  data_export: 'Data export',
};

export function PulseAuditLogPage() {
  const [action, setAction] = useState('');
  const { data, error } = usePulseQuery<any>(
    `/pulse/audit?limit=100${action ? `&action=${action}` : ''}`,
  );

  const logs = data?.logs || [];

  return (
    <PulseShell
      title="Audit Log"
      subtitle="Sensitive operator actions recorded by Pulse: visitor data deletions, retention cleanups, CSV imports, warehouse export runs and data exports — who did them, where, and when."
    >
      <StatusMessage error={error} />

      <Row gap="3" alignItems="center">
        <Text size="sm" weight="bold">
          Action type
        </Text>
        <select
          style={{ ...inputStyle, minWidth: 200 }}
          value={action}
          onChange={e => setAction(e.target.value)}
        >
          <option value="">All actions</option>
          {Object.entries(ACTION_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <Text size="sm" color="muted">
          {data ? `${logs.length} entries` : 'Loading…'}
        </Text>
      </Row>

      {logs.length === 0 ? (
        <EmptyNote>No audit entries yet for this filter.</EmptyNote>
      ) : (
        <TableWrap><table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>When</th>
              <th style={thStyle}>User</th>
              <th style={thStyle}>Action</th>
              <th style={thStyle}>Website</th>
              <th style={thStyle}>Details</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log: any) => (
              <tr key={log.id}>
                <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{formatDateTime(log.createdAt)}</td>
                <td style={tdStyle}>{log.username || '—'}</td>
                <td style={tdStyle}>{ACTION_LABELS[log.action] || log.action}</td>
                <td style={tdStyle}>{log.websiteName || log.websiteId || '—'}</td>
                <td style={tdStyle}>
                  <Text
                    size="sm"
                    style={{ fontFamily: 'monospace', wordBreak: 'break-word' }}
                  >
                    {log.details ? JSON.stringify(log.details) : '—'}
                  </Text>
                </td>
              </tr>
            ))}
          </tbody>
        </table></TableWrap>
      )}
    </PulseShell>
  );
}
