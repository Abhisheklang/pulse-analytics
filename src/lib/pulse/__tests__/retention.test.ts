import { describe, expect, it } from 'vitest';
import { retentionCutoff } from '../retention';

describe('retentionCutoff', () => {
  const now = Date.parse('2026-11-14T12:00:00.000Z');

  it('subtracts the retention window in days', () => {
    const cutoff = retentionCutoff(30, now);
    expect(cutoff?.toISOString()).toBe('2026-10-15T12:00:00.000Z');
  });

  it('handles a 1-day window', () => {
    expect(retentionCutoff(1, now)?.toISOString()).toBe('2026-11-13T12:00:00.000Z');
  });

  it('returns null when retention is disabled (0 or negative)', () => {
    expect(retentionCutoff(0, now)).toBeNull();
    expect(retentionCutoff(-5, now)).toBeNull();
  });
});
