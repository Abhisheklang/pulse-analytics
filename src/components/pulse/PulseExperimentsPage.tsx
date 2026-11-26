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

interface VariantForm {
  key: string;
  name: string;
  weight: string;
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);

function ResultsTable({ results }: { results: any }) {
  if (!results) return null;
  const rows = results.results || [];

  return (
    <Column gap="3">
      {!results.enoughData && (
        <Row padding="3" style={{ background: '#fef9c3', borderRadius: 'var(--pulse-radius-control)' }}>
          <Text>
            Not enough data yet — every variant needs at least {results.minExposures} exposed
            visitors before a significance verdict is meaningful. Current numbers are shown
            below, but treat them as indicative only.
          </Text>
        </Row>
      )}
      <TableWrap><table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>Variant</th>
            <th style={thStyle}>Exposures</th>
            <th style={thStyle}>Conversions</th>
            <th style={thStyle}>Rate</th>
            <th style={thStyle}>Uplift vs control</th>
            <th style={thStyle}>z-score</th>
            <th style={thStyle}>p-value</th>
            <th style={thStyle}>Verdict (95%)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r: any) => (
            <tr key={r.key}>
              <td style={tdStyle}>
                {r.name} <Text color="muted">({r.key})</Text>
                {r.control && (
                  <span
                    style={{
                      marginLeft: 8,
                      padding: '1px 8px',
                      borderRadius: 999,
                      background: 'var(--zen-status-info-bg, #e0e7ff)',
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    control
                  </span>
                )}
              </td>
              <td style={tdStyle}>{r.exposures}</td>
              <td style={tdStyle}>{r.conversions}</td>
              <td style={tdStyle}>{(r.rate * 100).toFixed(1)}%</td>
              <td style={tdStyle}>
                {r.upliftPct == null ? '—' : `${r.upliftPct > 0 ? '+' : ''}${r.upliftPct}%`}
              </td>
              <td style={tdStyle}>{r.zScore ?? '—'}</td>
              <td style={tdStyle}>{r.pValue ?? '—'}</td>
              <td style={tdStyle}>
                {r.control ? (
                  '—'
                ) : !results.enoughData ? (
                  <StatusChip tone="neutral">Not enough data</StatusChip>
                ) : r.significant ? (
                  r.upliftPct > 0 ? (
                    <StatusChip tone="success">Significant winner</StatusChip>
                  ) : (
                    <StatusChip tone="danger">Significantly worse</StatusChip>
                  )
                ) : (
                  <StatusChip tone="warning">Not significant</StatusChip>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table></TableWrap>
      <Text size="sm" color="muted">
        Exposures count distinct visitors (sessions) assigned to a variant; a conversion is an
        exposed session that later fired the conversion event. Significance uses a pooled
        two-proportion z-test against the control.
      </Text>
    </Column>
  );
}

export function PulseExperimentsPage({ websiteId }: { websiteId: string }) {
  const { get, post, put, del } = useApi();
  const { data, reload } = usePulseQuery<any>(`/pulse/websites/${websiteId}/experiments`);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [results, setResults] = useState<any>(null);

  const [form, setForm] = useState({
    name: '',
    key: '',
    conversionEvent: 'signup',
    status: 'draft',
  });
  const [variants, setVariants] = useState<VariantForm[]>([
    { key: 'a', name: 'Control', weight: '50' },
    { key: 'b', name: 'Variant B', weight: '50' },
  ]);

  const experiments = data?.experiments || [];

  const loadResults = async (id: string) => {
    setSelectedId(id);
    setResults(null);
    try {
      const res = await get(`/pulse/websites/${websiteId}/experiments/${id}?days=30`);
      setResults(res);
    } catch (e: any) {
      setError(e?.message || 'Failed to load results');
    }
  };

  const handleCreate = async () => {
    setError(null);
    try {
      const payload = {
        name: form.name,
        key: form.key || slugify(form.name),
        conversionEvent: form.conversionEvent,
        status: form.status,
        variants: variants.map((v, i) => ({
          key: v.key,
          name: v.name || v.key,
          weight: Number(v.weight) || 1,
          control: i === 0,
        })),
      };
      const res = await post(`/pulse/websites/${websiteId}/experiments`, payload);
      setNotice(`Experiment "${res.experiment.name}" created.`);
      setForm({ name: '', key: '', conversionEvent: 'signup', status: 'draft' });
      reload();
      loadResults(res.experiment.id);
    } catch (e: any) {
      setError(e?.message || 'Create failed');
    }
  };

  const handleStatus = async (exp: any, status: string) => {
    setError(null);
    try {
      await put(`/pulse/websites/${websiteId}/experiments/${exp.id}`, { status });
      setNotice(`Experiment "${exp.name}" is now ${status}.`);
      reload();
    } catch (e: any) {
      setError(e?.message || 'Update failed');
    }
  };

  const handleDelete = async (exp: any) => {
    if (!window.confirm(`Delete the experiment "${exp.name}"? This cannot be undone.`)) return;
    setError(null);
    try {
      await del(`/pulse/websites/${websiteId}/experiments/${exp.id}`);
      setNotice(`Experiment "${exp.name}" deleted.`);
      if (selectedId === exp.id) {
        setSelectedId(null);
        setResults(null);
      }
      reload();
    } catch (e: any) {
      setError(e?.message || 'Delete failed');
    }
  };

  return (
    <PulseShell
      title="A/B Testing"
      subtitle="Run experiments on this website: the optional Pulse A/B add-on script assigns visitors to variants and reports exposures; conversions are exposed sessions that fire your conversion event. Results include a two-proportion z-test against the control."
    >
      <StatusMessage error={error} notice={notice} />

      <Text size="sm" color="muted">
        To collect assignments, add this add-on next to the standard tracking script on your
        site: <code>{'<script async src="/pulse-ab.js"></script>'}</code> — then read the
        assigned variant in your page code via{' '}
        <code>{'window.pulseAb.getVariant("experiment-key")'}</code>.
      </Text>

      <Column gap="3">
        <Text size="lg" weight="bold">
          Create experiment
        </Text>
        <Row gap="3" wrap="wrap" alignItems="flex-end">
          <Field label="Name">
            <input
              style={inputStyle}
              value={form.name}
              onChange={e =>
                setForm({ ...form, name: e.target.value, key: slugify(e.target.value) })
              }
              placeholder="Homepage hero test"
            />
          </Field>
          <Field label="Key">
            <input
              style={{ ...inputStyle, minWidth: 140 }}
              value={form.key}
              onChange={e => setForm({ ...form, key: e.target.value })}
              placeholder="hero-test"
            />
          </Field>
          <Field label="Conversion event">
            <input
              style={{ ...inputStyle, minWidth: 140 }}
              value={form.conversionEvent}
              onChange={e => setForm({ ...form, conversionEvent: e.target.value })}
              placeholder="signup"
            />
          </Field>
          <Field label="Status">
            <select
              style={{ ...inputStyle, minWidth: 120 }}
              value={form.status}
              onChange={e => setForm({ ...form, status: e.target.value })}
            >
              <option value="draft">Draft</option>
              <option value="running">Running</option>
              <option value="paused">Paused</option>
            </select>
          </Field>
        </Row>
        <Column gap="2">
          <Text size="sm" weight="bold">
            Variants (first row is the control)
          </Text>
          {variants.map((v, i) => (
            <Row key={i} gap="2" alignItems="center">
              <input
                style={{ ...inputStyle, minWidth: 110 }}
                value={v.key}
                onChange={e => {
                  const next = [...variants];
                  next[i] = { ...next[i], key: e.target.value };
                  setVariants(next);
                }}
                placeholder="key"
              />
              <input
                style={{ ...inputStyle, minWidth: 150 }}
                value={v.name}
                onChange={e => {
                  const next = [...variants];
                  next[i] = { ...next[i], name: e.target.value };
                  setVariants(next);
                }}
                placeholder="Name"
              />
              <input
                style={{ ...inputStyle, minWidth: 90 }}
                type="number"
                min={1}
                value={v.weight}
                onChange={e => {
                  const next = [...variants];
                  next[i] = { ...next[i], weight: e.target.value };
                  setVariants(next);
                }}
                placeholder="Weight"
              />
              {i === 0 ? (
                <Text size="sm" color="muted">
                  control
                </Text>
              ) : (
                <button
                  style={dangerButtonStyle}
                  onClick={() => setVariants(variants.filter((_, j) => j !== i))}
                >
                  Remove
                </button>
              )}
            </Row>
          ))}
          {variants.length < 5 && (
            <Row>
              <button
                style={quietButtonStyle}
                onClick={() =>
                  setVariants([
                    ...variants,
                    {
                      key: String.fromCharCode(97 + variants.length),
                      name: `Variant ${String.fromCharCode(65 + variants.length)}`,
                      weight: '50',
                    },
                  ])
                }
              >
                Add variant
              </button>
            </Row>
          )}
        </Column>
        <Row>
          <button style={primaryButtonStyle} onClick={handleCreate}>
            Create experiment
          </button>
        </Row>
      </Column>

      <Column gap="3">
        <Text size="lg" weight="bold">
          Experiments
        </Text>
        {experiments.length === 0 ? (
          <EmptyNote>No experiments yet. Create one above to start testing.</EmptyNote>
        ) : (
          <TableWrap><table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Key</th>
                <th style={thStyle}>Conversion event</th>
                <th style={thStyle}>Variants</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {experiments.map((exp: any) => (
                <tr key={exp.id} style={selectedId === exp.id ? { background: 'var(--zen-status-info-bg, #eef2ff)' } : {}}>
                  <td style={tdStyle}>{exp.name}</td>
                  <td style={tdStyle}>{exp.key}</td>
                  <td style={tdStyle}>{exp.conversionEvent}</td>
                  <td style={tdStyle}>
                    {(exp.variants || []).map((v: any) => v.key).join(', ')}
                  </td>
                  <td style={tdStyle}>{exp.status}</td>
                  <td style={tdStyle}>
                    <Row gap="2">
                      <button style={quietButtonStyle} onClick={() => loadResults(exp.id)}>
                        Results
                      </button>
                      {exp.status !== 'running' && (
                        <button style={quietButtonStyle} onClick={() => handleStatus(exp, 'running')}>
                          Run
                        </button>
                      )}
                      {exp.status === 'running' && (
                        <button style={quietButtonStyle} onClick={() => handleStatus(exp, 'paused')}>
                          Pause
                        </button>
                      )}
                      <button style={dangerButtonStyle} onClick={() => handleDelete(exp)}>
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

      {selectedId && (
        <Column gap="3">
          <Text size="lg" weight="bold">
            Results (last 30 days)
          </Text>
          {results ? <ResultsTable results={results} /> : <Text color="muted">Loading…</Text>}
        </Column>
      )}
    </PulseShell>
  );
}
