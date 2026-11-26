'use client';

import { Column, Row, Text } from '@pulselytics/react-zen';
import { useState } from 'react';
import { useApi } from '@/components/hooks';
import {
  EmptyNote,
  PulseShell,
  StatusChip,
  StatusMessage,
  TableWrap,
  cardStyle,
  inputStyle,
  numTdStyle,
  numThStyle,
  primaryButtonStyle,
  quietButtonStyle,
  tableStyle,
  tdStyle,
  thStyle,
  usePulseQuery,
} from './PulseShared';

interface AskEntry {
  question: string;
  response: any;
}

function ResultBars({ rows }: { rows: any[] }) {
  const max = Math.max(1, ...rows.map(r => r.value));
  return (
    <Column gap="2">
      {rows.slice(0, 10).map((row, i) => (
        <Row key={i} gap="3" alignItems="center">
          <div style={{ width: 180, minWidth: 0 }}>
            <Text size="sm" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
              {row.name}
            </Text>
          </div>
          <div
            style={{
              flex: 1,
              height: 14,
              borderRadius: 7,
              background: 'var(--zen-surface-raised, #f0f0f5)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${Math.max(2, (row.value / max) * 100)}%`,
                height: '100%',
                borderRadius: 7,
                background: 'var(--zen-primary, #4f46e5)',
              }}
            />
          </div>
          <Text size="sm" weight="bold" style={{ minWidth: 48, textAlign: 'right' }}>
            {row.value}
          </Text>
        </Row>
      ))}
    </Column>
  );
}

function AnswerCard({ entry }: { entry: AskEntry }) {
  const { response } = entry;
  const rows: any[] = response.rows || [];
  const hasPrevious = rows.some(r => r.previous !== undefined);
  const showBars = response.status === 'ok' && rows.length > 0 && !hasPrevious;

  return (
    <Column gap="3" style={cardStyle}>
      <Text weight="bold" size="lg">
        {entry.question}
      </Text>
      <Text>{response.explanation}</Text>

      {response.status === 'refused' && response.capabilities && (
        <Column gap="1">
          {response.capabilities.map((c: string) => (
            <Text key={c} size="sm" color="muted">
              • {c}
            </Text>
          ))}
        </Column>
      )}

      {response.plan && (
        <Text size="sm" color="muted">
          Query plan — intent: {response.plan.intent} · metric: {response.plan.metric} ·
          breakdown: {response.plan.dimension} · period: {response.plan.period}
          {response.plan.filter ? ` · filter: ${response.plan.filter}` : ''} · answered with the{' '}
          {response.mode === 'llm' ? 'LLM' : 'built-in'} parser
        </Text>
      )}

      {rows.length > 0 && (
        <TableWrap>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Name</th>
                <th style={numThStyle}>Value</th>
                {hasPrevious && <th style={numThStyle}>Previous period</th>}
                {hasPrevious && <th style={numThStyle}>Change</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  <td style={tdStyle}>{row.name}</td>
                  <td style={numTdStyle}>{row.value}</td>
                  {hasPrevious && <td style={numTdStyle}>{row.previous ?? '—'}</td>}
                  {hasPrevious && (
                    <td style={numTdStyle}>
                      {row.previous !== undefined ? row.value - row.previous : '—'}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}

      {showBars && <ResultBars rows={rows} />}
    </Column>
  );
}

export function PulseAskPage({ websiteId }: { websiteId: string }) {
  const { post } = useApi();
  const { data: meta } = usePulseQuery<any>(`/pulse/websites/${websiteId}/ask`);
  const [question, setQuestion] = useState('');
  const [entries, setEntries] = useState<AskEntry[]>([]);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const examples: string[] = meta?.examples || [];
  const llmMode = meta?.mode === 'llm';

  const ask = async (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 3 || asking) return;
    setAsking(true);
    setError(null);
    try {
      const response = await post(`/pulse/websites/${websiteId}/ask`, { question: trimmed });
      setEntries(prev => [{ question: trimmed, response }, ...prev]);
      setQuestion('');
    } catch (e: any) {
      setError(e?.message || 'Something went wrong while asking. Please try again.');
    } finally {
      setAsking(false);
    }
  };

  return (
    <PulseShell
      title="Ask Pulse"
      subtitle="Ask a plain-English question about this website's analytics. Every answer is computed from your real data with a visible query plan — numbers are never invented, and questions that cannot be answered from your data get an honest refusal."
      action={
        meta ? (
          llmMode ? (
            <StatusChip tone="info">LLM mode</StatusChip>
          ) : (
            <StatusChip tone="neutral">
              Built-in parser — add an API key for free-form questions
            </StatusChip>
          )
        ) : undefined
      }
    >
      <StatusMessage error={error} />

      <Column gap="3" style={cardStyle}>
        <Row gap="2" wrap="wrap">
          <input
            style={{ ...inputStyle, flex: 1, minWidth: 240 }}
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') ask(question);
            }}
            placeholder="e.g. Which pages got the most views this month?"
            maxLength={300}
            aria-label="Ask a question about your analytics"
          />
          <button
            type="button"
            style={primaryButtonStyle}
            disabled={asking}
            onClick={() => ask(question)}
          >
            {asking ? 'Asking…' : 'Ask'}
          </button>
        </Row>
        {examples.length > 0 && (
          <Row gap="2" wrap="wrap">
            {examples.map(example => (
              <button
                key={example}
                type="button"
                style={{ ...quietButtonStyle, maxWidth: '100%', whiteSpace: 'normal', textAlign: 'left' }}
                disabled={asking}
                onClick={() => ask(example)}
              >
                {example}
              </button>
            ))}
          </Row>
        )}
        {!llmMode && meta && (
          <Text size="sm" color="muted">
            The built-in parser covers the question types listed under the examples. Set the
            OPENAI_API_KEY environment variable on the server to enable LLM mode for free-form
            phrasing — answers still run through the same safe, allow-listed query plans.
          </Text>
        )}
      </Column>

      {entries.length === 0 ? (
        <EmptyNote>
          No questions yet. Pick an example above or type your own — try “Why did traffic drop last
          Tuesday?”
        </EmptyNote>
      ) : (
        <Column gap="3">
          {entries.map((entry, i) => (
            <AnswerCard key={`${i}-${entry.question}`} entry={entry} />
          ))}
        </Column>
      )}
    </PulseShell>
  );
}
