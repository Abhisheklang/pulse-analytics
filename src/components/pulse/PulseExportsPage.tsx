'use client';

import { Column, Row, Text } from '@pulselytics/react-zen';
import { useState } from 'react';
import { useApi } from '@/components/hooks';
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
  StatusChip,
} from './PulseShared';

const emptyS3 = {
  endpoint: 'https://s3.amazonaws.com',
  bucket: '',
  prefix: 'pulse-export',
  region: 'us-east-1',
  accessKeyId: '',
  secretAccessKey: '',
};

const emptyBq = {
  project: '',
  dataset: '',
  table: '',
  serviceAccountEmail: '',
  privateKey: '',
};

export function PulseExportsPage({ websiteId }: { websiteId: string }) {
  const { post, del } = useApi();
  const { data, reload } = usePulseQuery<any>(`/pulse/websites/${websiteId}/exports`);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [rangeDays, setRangeDays] = useState('365');

  const [form, setForm] = useState({
    name: '',
    destination: 's3',
    format: 'ndjson',
  });
  const [s3, setS3] = useState(emptyS3);
  const [bq, setBq] = useState(emptyBq);

  const jobs = data?.jobs || [];
  const logs = data?.logs || [];

  const handleCreate = async () => {
    setError(null);
    try {
      const config = form.destination === 's3' ? s3 : bq;
      const res = await post(`/pulse/websites/${websiteId}/exports`, {
        name: form.name,
        destination: form.destination,
        format: form.format,
        config,
        enabled: true,
      });
      setNotice(`Export job "${res.job.name}" created.`);
      setForm({ name: '', destination: 's3', format: 'ndjson' });
      setS3(emptyS3);
      setBq(emptyBq);
      reload();
    } catch (e: any) {
      setError(e?.message || 'Create failed');
    }
  };

  const handleRun = async (job: any) => {
    setError(null);
    setRunningId(job.id);
    try {
      const res = await post(
        `/pulse/websites/${websiteId}/exports/${job.id}/run?days=${rangeDays}`,
        {},
      );
      if (res.ok) {
        setNotice(
          `Export "${job.name}" completed: ${res.log.rowsExported} rows, ${res.log.bytes} bytes.`,
        );
      } else {
        setError(`Export "${job.name}" failed: ${res.error}`);
      }
      reload();
    } catch (e: any) {
      setError(e?.message || 'Run failed');
    } finally {
      setRunningId(null);
    }
  };

  const handleDelete = async (job: any) => {
    setError(null);
    try {
      await del(`/pulse/websites/${websiteId}/exports/${job.id}`);
      setNotice(`Export job "${job.name}" deleted.`);
      reload();
    } catch (e: any) {
      setError(e?.message || 'Delete failed');
    }
  };

  return (
    <PulseShell
      title="Warehouse Export"
      subtitle="Ship this website's raw events to a data warehouse: an S3-compatible bucket (AWS S3, MinIO, R2, …) as NDJSON/CSV files, or straight into BigQuery with a service account. Exports cover the selected range ending now."
    >
      <StatusMessage error={error} notice={notice} />

      <Column gap="3">
        <Text size="lg" weight="bold">
          Create export job
        </Text>
        <Row gap="3" wrap="wrap" alignItems="flex-end">
          <Field label="Name">
            <input
              style={inputStyle}
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="Nightly warehouse dump"
            />
          </Field>
          <Field label="Destination">
            <select
              style={{ ...inputStyle, minWidth: 160 }}
              value={form.destination}
              onChange={e => setForm({ ...form, destination: e.target.value })}
            >
              <option value="s3">S3-compatible bucket</option>
              <option value="bigquery">BigQuery</option>
            </select>
          </Field>
          <Field label="Format">
            <select
              style={{ ...inputStyle, minWidth: 120 }}
              value={form.format}
              onChange={e => setForm({ ...form, format: e.target.value })}
            >
              <option value="ndjson">NDJSON</option>
              <option value="csv">CSV</option>
            </select>
          </Field>
        </Row>

        {form.destination === 's3' ? (
          <Row gap="3" wrap="wrap" alignItems="flex-end">
            <Field label="Endpoint URL">
              <input
                style={{ ...inputStyle, minWidth: 260 }}
                value={s3.endpoint}
                onChange={e => setS3({ ...s3, endpoint: e.target.value })}
                placeholder="https://s3.amazonaws.com"
              />
            </Field>
            <Field label="Bucket">
              <input
                style={inputStyle}
                value={s3.bucket}
                onChange={e => setS3({ ...s3, bucket: e.target.value })}
                placeholder="my-bucket"
              />
            </Field>
            <Field label="Key prefix">
              <input
                style={inputStyle}
                value={s3.prefix}
                onChange={e => setS3({ ...s3, prefix: e.target.value })}
              />
            </Field>
            <Field label="Region">
              <input
                style={{ ...inputStyle, minWidth: 120 }}
                value={s3.region}
                onChange={e => setS3({ ...s3, region: e.target.value })}
              />
            </Field>
            <Field label="Access key ID">
              <input
                style={inputStyle}
                value={s3.accessKeyId}
                onChange={e => setS3({ ...s3, accessKeyId: e.target.value })}
              />
            </Field>
            <Field label="Secret access key">
              <input
                style={inputStyle}
                type="password"
                value={s3.secretAccessKey}
                onChange={e => setS3({ ...s3, secretAccessKey: e.target.value })}
              />
            </Field>
          </Row>
        ) : (
          <Column gap="3">
            <Row gap="3" wrap="wrap" alignItems="flex-end">
              <Field label="Project">
                <input
                  style={inputStyle}
                  value={bq.project}
                  onChange={e => setBq({ ...bq, project: e.target.value })}
                  placeholder="my-gcp-project"
                />
              </Field>
              <Field label="Dataset">
                <input
                  style={inputStyle}
                  value={bq.dataset}
                  onChange={e => setBq({ ...bq, dataset: e.target.value })}
                  placeholder="analytics"
                />
              </Field>
              <Field label="Table">
                <input
                  style={inputStyle}
                  value={bq.table}
                  onChange={e => setBq({ ...bq, table: e.target.value })}
                  placeholder="pulse_events"
                />
              </Field>
              <Field label="Service account email">
                <input
                  style={{ ...inputStyle, minWidth: 280 }}
                  value={bq.serviceAccountEmail}
                  onChange={e => setBq({ ...bq, serviceAccountEmail: e.target.value })}
                  placeholder="pulse@my-gcp-project.iam.gserviceaccount.com"
                />
              </Field>
            </Row>
            <Field label="Service account private key (PEM)">
              <textarea
                style={{ ...inputStyle, minWidth: 520, minHeight: 90, fontFamily: 'monospace' }}
                value={bq.privateKey}
                onChange={e => setBq({ ...bq, privateKey: e.target.value })}
                placeholder="-----BEGIN PRIVATE KEY-----"
              />
            </Field>
          </Column>
        )}

        <Row>
          <button style={primaryButtonStyle} onClick={handleCreate}>
            Create export job
          </button>
        </Row>
      </Column>

      <Column gap="3">
        <Row gap="3" alignItems="center">
          <Text size="lg" weight="bold">
            Export jobs
          </Text>
          <Text size="sm" weight="bold">
            Range
          </Text>
          <select
            style={{ ...inputStyle, minWidth: 130 }}
            value={rangeDays}
            onChange={e => setRangeDays(e.target.value)}
          >
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="365">Last 365 days</option>
            <option value="3650">All time (10y)</option>
          </select>
        </Row>
        {jobs.length === 0 ? (
          <EmptyNote>No export jobs yet. Create one above.</EmptyNote>
        ) : (
          <TableWrap><table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Destination</th>
                <th style={thStyle}>Format</th>
                <th style={thStyle}>Target</th>
                <th style={thStyle}>Last run</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job: any) => (
                <tr key={job.id}>
                  <td style={tdStyle}>{job.name}</td>
                  <td style={tdStyle}>{job.destination === 's3' ? 'S3 bucket' : 'BigQuery'}</td>
                  <td style={tdStyle}>{job.format}</td>
                  <td style={tdStyle}>
                    {job.destination === 's3'
                      ? `${job.config?.endpoint || ''}/${job.config?.bucket || ''}`
                      : `${job.config?.project}.${job.config?.dataset}.${job.config?.table}`}
                  </td>
                  <td style={tdStyle}>{formatDateTime(job.lastRunAt)}</td>
                  <td style={tdStyle}>
                    <Row gap="2">
                      <button
                        style={primaryButtonStyle}
                        onClick={() => handleRun(job)}
                        disabled={runningId === job.id}
                      >
                        {runningId === job.id ? 'Running…' : 'Run export'}
                      </button>
                      <button style={dangerButtonStyle} onClick={() => handleDelete(job)}>
                        Delete
                      </button>
                    </Row>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></TableWrap>
        )}
      </Column>

      <Column gap="3">
        <Text size="lg" weight="bold">
          Export history
        </Text>
        {logs.length === 0 ? (
          <EmptyNote>No export runs yet.</EmptyNote>
        ) : (
          <TableWrap><table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>When</th>
                <th style={thStyle}>Destination</th>
                <th style={thStyle}>Format</th>
                <th style={thStyle}>Rows</th>
                <th style={thStyle}>Bytes</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Error</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log: any) => (
                <tr key={log.id}>
                  <td style={tdStyle}>{formatDateTime(log.createdAt)}</td>
                  <td style={tdStyle}>{log.destination}</td>
                  <td style={tdStyle}>{log.format}</td>
                  <td style={tdStyle}>{log.rowsExported}</td>
                  <td style={tdStyle}>{log.bytes}</td>
                  <td style={tdStyle}>
                    <StatusChip tone={log.status === 'success' ? 'success' : 'danger'}>
                      {log.status === 'success' ? 'Success' : 'Failed'}
                    </StatusChip>
                  </td>
                  <td style={tdStyle}>{log.error || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table></TableWrap>
        )}
      </Column>
    </PulseShell>
  );
}
