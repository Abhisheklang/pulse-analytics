import { describe, expect, it } from 'vitest';
import { isJobDue } from '../scheduler';

describe('isJobDue', () => {
  const now = Date.parse('2026-11-14T12:00:00.000Z');
  const minute = 60_000;

  it('a job that never ran is due', () => {
    expect(isJobDue(null, 5 * minute, now)).toBe(true);
  });

  it('a job inside its interval is not due', () => {
    expect(isJobDue(now - 4 * minute, 5 * minute, now)).toBe(false);
  });

  it('a job past its interval is due', () => {
    expect(isJobDue(now - 6 * minute, 5 * minute, now)).toBe(true);
  });

  it('exactly at the interval boundary is due', () => {
    expect(isJobDue(now - 5 * minute, 5 * minute, now)).toBe(true);
  });

  it('a non-positive interval always runs', () => {
    expect(isJobDue(now, 0, now)).toBe(true);
  });
});
