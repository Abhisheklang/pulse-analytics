'use client';

import { Column, Row, Text } from '@pulselytics/react-zen';
import { useRef, useState } from 'react';
import { useApi } from '@/components/hooks';
import {
  EmptyNote,
  Field,
  PulseShell,
  StatusMessage,
  formatDateTime,
  inputStyle,
  primaryButtonStyle,
  tableStyle,
  tdStyle,
  thStyle,
  usePulseQuery,
  TableWrap,
} from './PulseShared';

export function PulseImportPage({ websiteId }: { websiteId: string }) {
  const { post } = useApi();
  const { data, reload } = usePulseQuery<any>(`/pulse/websites/${websiteId}/import`);
  const [source, setSource] = useState('ga4');
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState('');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const logs = data?.logs || [];

  const handleFile = async (file: File) => {
    setFileName(file.name);
    setCsvText(await file.text());
  };

  const handleImport = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await post(`/pulse/websites/${websiteId}/import`, { source, csv: csvText });
      setResult(res);
      reload();
    } catch (e: any) {
      setError(e?.message || 'Import failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <PulseShell
      title="CSV Importer"
      subtitle="Bring historical traffic into this website. Presets map GA4, Plausible and Matomo export columns; imported rows become real pageviews and sessions, so they show up in all stats."
    >
      <StatusMessage error={error} />

      <Column gap="3">
        <Row gap="3" wrap="wrap" alignItems="flex-end">
          <Field label="Source preset">
            <select style={inputStyle} value={source} onChange={e => setSource(e.target.value)}>
              <option value="ga4">Google Analytics 4</option>
              <option value="plausible">Plausible</option>
              <option value="matomo">Matomo</option>
              <option value="generic">Generic (date, url, referrer, country, browser, os, device)</option>
            </select>
          </Field>
          <Field label="CSV file">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </Field>
          <button
            style={primaryButtonStyle}
            onClick={handleImport}
            disabled={busy || !csvText}
          >
            {busy ? 'Importing…' : 'Import CSV'}
          </button>
        </Row>
        {fileName && (
          <Text size="sm" color="muted">
            Loaded {fileName} ({csvText.length} characters). Aggregate rows with a views/pageviews count
            are expanded into individual pageviews.
          </Text>
        )}
        {result && (
          <Text>
            Import finished: <b>{result.rowsImported}</b> pageviews imported,{' '}
            <b>{result.rowsSkipped}</b> rows skipped.
            {result.errors?.length ? ` Errors: ${result.errors.join(' · ')}` : ''}
          </Text>
        )}
      </Column>

      <Column gap="3">
        <Text size="lg" weight="bold">
          Import history
        </Text>
        {logs.length === 0 ? (
          <EmptyNote>No imports yet.</EmptyNote>
        ) : (
          <TableWrap><table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>When</th>
                <th style={thStyle}>Source</th>
                <th style={thStyle}>Imported</th>
                <th style={thStyle}>Skipped</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log: any) => (
                <tr key={log.id}>
                  <td style={tdStyle}>{formatDateTime(log.createdAt)}</td>
                  <td style={tdStyle}>{log.source}</td>
                  <td style={tdStyle}>{log.rowsImported}</td>
                  <td style={tdStyle}>{log.rowsSkipped}</td>
                </tr>
              ))}
            </tbody>
          </table></TableWrap>
        )}
      </Column>
    </PulseShell>
  );
}
