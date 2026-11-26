'use client';

import { Column, Row, Text } from '@pulselytics/react-zen';
import { useCallback, useEffect, useState } from 'react';
import { useApi } from '@/components/hooks';
import {
  EmptyNote,
  Field,
  PulseShell,
  Reveal,
  StatusMessage,
  cardStyle,
  dangerButtonStyle,
  inputStyle,
  primaryButtonStyle,
  quietButtonStyle,
  usePulseQuery,
} from './PulseShared';

interface Widget {
  id: string;
  type: string;
  websiteId: string;
  days: number;
  span?: number;
}

const newWidgetId = () =>
  `w-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

function WidgetValue({ widget, value }: { widget: Widget; value: any }) {
  if (!value) return <Text color="muted">Loading…</Text>;
  if (value.error) return <Text style={{ color: 'var(--zen-status-error, #b91c1c)' }}>{value.error}</Text>;

  switch (widget.type) {
    case 'visitors':
    case 'views':
    case 'online':
      return (
        <Text size="2xl" weight="bold">
          {value.value}
        </Text>
      );
    case 'bounce':
      return (
        <Text size="2xl" weight="bold">
          {value.value}%
        </Text>
      );
    case 'revenue':
      return (
        <Text size="2xl" weight="bold">
          {value.currency} {Number(value.value).toFixed(2)}
        </Text>
      );
    case 'trend': {
      const series = value.series || [];
      const max = Math.max(1, ...series.map((d: any) => d.pageviews));
      return (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 70 }}>
          {series.map((d: any) => (
            <div
              key={d.date}
              title={`${d.date}: ${d.pageviews}`}
              style={{
                flex: 1,
                minHeight: 2,
                height: `${Math.max(3, (d.pageviews / max) * 100)}%`,
                background: '#4f46e5',
                borderRadius: 2,
              }}
            />
          ))}
        </div>
      );
    }
    case 'top-pages':
    case 'top-referrers':
    case 'top-countries':
    case 'devices': {
      const rows = value.rows || [];
      if (!rows.length) return <Text color="muted">No data</Text>;
      return (
        <Column gap="1">
          {rows.map((r: any) => (
            <Row key={r.name} justifyContent="space-between" gap="3">
              <Text
                style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {r.name}
              </Text>
              <Text weight="bold">{r.count}</Text>
            </Row>
          ))}
        </Column>
      );
    }
    default:
      return <Text color="muted">Unknown widget</Text>;
  }
}

export function PulseDashboardsPage() {
  const { get, post, put, del } = useApi();
  const { data, reload } = usePulseQuery<any>('/pulse/dashboards');
  const { data: rollup } = usePulseQuery<any>('/pulse/rollup?days=30');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [values, setValues] = useState<Record<string, any>>({});
  const [editing, setEditing] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [addForm, setAddForm] = useState({ type: 'visitors', websiteId: '', days: '30' });

  const dashboards = data?.dashboards || [];
  const catalog = data?.catalog || [];
  const websites = (rollup?.perSite || []).map((s: any) => ({
    id: s.websiteId,
    name: s.name,
  }));

  const catalogLabel = (type: string) =>
    catalog.find((c: any) => c.type === type)?.label || type;

  const openDashboard = useCallback(async (id: string) => {
    setError(null);
    try {
      const res = await get(`/pulse/dashboards/${id}`);
      setSelected(res.dashboard);
      setEditing(false);
      const dataRes = await get(`/pulse/dashboards/${id}/data`);
      setValues(dataRes.values || {});
    } catch (e: any) {
      setError(e?.message || 'Failed to open dashboard');
    }
  }, [get]);

  // FIN-4: depend on the list itself, not only its length, so a
  // reloaded list cannot auto-open a stale first dashboard.
  useEffect(() => {
    if (!selected && dashboards.length) {
      openDashboard(dashboards[0].id);
    }
  }, [dashboards, selected, openDashboard]);

  const handleCreate = async () => {
    setError(null);
    try {
      const res = await post('/pulse/dashboards', { name: newName || 'Untitled dashboard' });
      setNotice(`Dashboard "${res.dashboard.name}" created.`);
      setNewName('');
      reload();
      openDashboard(res.dashboard.id);
    } catch (e: any) {
      setError(e?.message || 'Create failed');
    }
  };

  const handleSave = async () => {
    if (!selected) return;
    setError(null);
    try {
      const res = await put(`/pulse/dashboards/${selected.id}`, {
        name: selected.name,
        layout: selected.layout,
      });
      setSelected(res.dashboard);
      setNotice('Dashboard saved.');
      setEditing(false);
      reload();
      const dataRes = await get(`/pulse/dashboards/${selected.id}/data`);
      setValues(dataRes.values || {});
    } catch (e: any) {
      setError(e?.message || 'Save failed');
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    setError(null);
    try {
      await del(`/pulse/dashboards/${selected.id}`);
      setNotice(`Dashboard "${selected.name}" deleted.`);
      setSelected(null);
      setValues({});
      reload();
    } catch (e: any) {
      setError(e?.message || 'Delete failed');
    }
  };

  const updateWidget = (index: number, patch: Partial<Widget>) => {
    const layout = [...(selected.layout || [])];
    layout[index] = { ...layout[index], ...patch };
    setSelected({ ...selected, layout });
  };

  const removeWidget = (index: number) => {
    const layout = [...(selected.layout || [])];
    layout.splice(index, 1);
    setSelected({ ...selected, layout });
  };

  const addWidget = () => {
    const websiteId = addForm.websiteId || websites[0]?.id;
    if (!websiteId) {
      setError('No websites available for widgets.');
      return;
    }
    const widget: Widget = {
      id: newWidgetId(),
      type: addForm.type,
      websiteId,
      days: Number(addForm.days) || 30,
      span: 1,
    };
    setSelected({ ...selected, layout: [...(selected.layout || []), widget] });
  };

  const handleDrop = (targetIndex: number) => {
    if (dragIndex === null || dragIndex === targetIndex || !selected) return;
    const layout = [...(selected.layout || [])];
    const [moved] = layout.splice(dragIndex, 1);
    layout.splice(targetIndex, 0, moved);
    setSelected({ ...selected, layout });
    setDragIndex(null);
  };

  const layout: Widget[] = selected?.layout || [];

  return (
    <PulseShell
      title="Custom Dashboards"
      subtitle="Build your own dashboards from Pulse widgets — stats, trends, top lists, revenue and realtime counts — bound to any website and period. Drag widgets to reorder them; the layout is saved per dashboard."
    >
      <StatusMessage error={error} notice={notice} />

      <Row gap="3" wrap="wrap" alignItems="flex-end">
        <Field label="Your dashboards">
          <select
            style={{ ...inputStyle, minWidth: 220 }}
            value={selected?.id || ''}
            onChange={e => e.target.value && openDashboard(e.target.value)}
          >
            {!selected && <option value="">Select a dashboard…</option>}
            {dashboards.map((d: any) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="New dashboard name">
          <input
            style={inputStyle}
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Marketing overview"
          />
        </Field>
        <button style={primaryButtonStyle} onClick={handleCreate}>
          Create dashboard
        </button>
        {selected && (
          <>
            <button style={quietButtonStyle} onClick={() => setEditing(!editing)}>
              {editing ? 'Done editing' : 'Edit layout'}
            </button>
            <button style={dangerButtonStyle} onClick={handleDelete}>
              Delete dashboard
            </button>
          </>
        )}
      </Row>

      {!selected ? (
        <EmptyNote>Create or select a dashboard to get started.</EmptyNote>
      ) : editing ? (
        <Column gap="3">
          <Row gap="3" alignItems="flex-end">
            <Field label="Dashboard name">
              <input
                style={inputStyle}
                value={selected.name}
                onChange={e => setSelected({ ...selected, name: e.target.value })}
              />
            </Field>
            <button style={primaryButtonStyle} onClick={handleSave}>
              Save layout
            </button>
          </Row>
          <Text size="sm" color="muted">
            Drag a widget row by its handle to reorder. Changes are saved when you press “Save
            layout”.
          </Text>
          <Column gap="2">
            {layout.map((w, i) => (
              <Row
                key={w.id}
                gap="3"
                alignItems="center"
                draggable
                onDragStart={() => setDragIndex(i)}
                onDragOver={e => e.preventDefault()}
                onDrop={() => handleDrop(i)}
                style={{
                  ...cardStyle,
                  padding: 10,
                  cursor: 'grab',
                  opacity: dragIndex === i ? 0.5 : 1,
                }}
              >
                <Text weight="bold">⠿</Text>
                <Text weight="bold" style={{ minWidth: 150 }}>
                  {catalogLabel(w.type)}
                </Text>
                <select
                  style={{ ...inputStyle, minWidth: 170 }}
                  value={w.websiteId}
                  onChange={e => updateWidget(i, { websiteId: e.target.value })}
                >
                  {websites.map((s: any) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <select
                  style={{ ...inputStyle, minWidth: 120 }}
                  value={String(w.days)}
                  onChange={e => updateWidget(i, { days: Number(e.target.value) })}
                >
                  <option value="7">Last 7 days</option>
                  <option value="30">Last 30 days</option>
                  <option value="90">Last 90 days</option>
                </select>
                <select
                  style={{ ...inputStyle, minWidth: 100 }}
                  value={String(w.span || 1)}
                  onChange={e => updateWidget(i, { span: Number(e.target.value) })}
                >
                  <option value="1">1 column</option>
                  <option value="2">2 columns</option>
                  <option value="3">3 columns</option>
                </select>
                <button style={dangerButtonStyle} onClick={() => removeWidget(i)}>
                  Remove
                </button>
              </Row>
            ))}
            {!layout.length && <EmptyNote>No widgets yet — add one below.</EmptyNote>}
          </Column>
          <Row gap="3" wrap="wrap" alignItems="flex-end">
            <Field label="Widget type">
              <select
                style={{ ...inputStyle, minWidth: 180 }}
                value={addForm.type}
                onChange={e => setAddForm({ ...addForm, type: e.target.value })}
              >
                {catalog.map((c: any) => (
                  <option key={c.type} value={c.type}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Website">
              <select
                style={{ ...inputStyle, minWidth: 170 }}
                value={addForm.websiteId || websites[0]?.id || ''}
                onChange={e => setAddForm({ ...addForm, websiteId: e.target.value })}
              >
                {websites.map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Period">
              <select
                style={{ ...inputStyle, minWidth: 120 }}
                value={addForm.days}
                onChange={e => setAddForm({ ...addForm, days: e.target.value })}
              >
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
              </select>
            </Field>
            <button style={quietButtonStyle} onClick={addWidget}>
              Add widget
            </button>
          </Row>
        </Column>
      ) : (
        <Column gap="3">
          <Text size="xl" weight="bold">
            {selected.name}
          </Text>
          {!layout.length ? (
            <EmptyNote>This dashboard has no widgets yet. Use “Edit layout” to add some.</EmptyNote>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 16,
              }}
            >
              {layout.map(w => (
                <Reveal
                  key={w.id}
                  style={{ gridColumn: `span ${Math.min(3, w.span || 1)}`, minWidth: 0 }}
                >
                  <div style={{ ...cardStyle, height: '100%', boxSizing: 'border-box' }}>
                    <Column gap="2">
                      <Text size="sm" weight="bold">
                        {catalogLabel(w.type)}
                        <Text color="muted">
                          {' '}
                          · {websites.find((s: any) => s.id === w.websiteId)?.name || 'website'} ·{' '}
                          {w.days}d
                        </Text>
                      </Text>
                      <WidgetValue widget={w} value={values[w.id]} />
                    </Column>
                  </div>
                </Reveal>
              ))}
            </div>
          )}
        </Column>
      )}
    </PulseShell>
  );
}
