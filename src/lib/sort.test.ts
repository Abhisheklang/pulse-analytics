import { describe, expect, test } from 'vitest';
import { sanitizeRawOrderBy, sanitizeSortFilters } from './sort';

describe('sanitizeSortFilters', () => {
  const allowed = ['name', 'createdAt'] as const;

  test('keeps orderBy and sortDescending when the field is allowed', () => {
    const result = sanitizeSortFilters({ orderBy: 'name', sortDescending: true }, allowed);
    expect(result).toEqual({ orderBy: 'name', sortDescending: true });
  });

  test('drops orderBy when the field is not allowed', () => {
    const result = sanitizeSortFilters({ orderBy: 'secret', sortDescending: true }, allowed);
    expect(result).toEqual({});
  });

  test('falls back to defaults when the field is not allowed', () => {
    const result = sanitizeSortFilters({ orderBy: 'secret' }, allowed, {
      orderBy: 'createdAt',
      sortDescending: false,
    });
    expect(result).toEqual({ orderBy: 'createdAt', sortDescending: false });
  });

  test('applies defaults when orderBy is missing', () => {
    const result = sanitizeSortFilters({}, allowed, { orderBy: 'name' });
    expect(result).toEqual({ orderBy: 'name' });
  });

  test('preserves other filter fields', () => {
    const result = sanitizeSortFilters({ orderBy: 'bad', startDate: new Date(0) } as any, allowed);
    expect(result).toMatchObject({ startDate: new Date(0) });
    expect(result).not.toHaveProperty('orderBy');
  });
});

describe('sanitizeRawOrderBy (P-ADV-2 sink allowlist)', () => {
  test('keeps plain column references', () => {
    expect(sanitizeRawOrderBy('created_at')).toBe('created_at');
    expect(sanitizeRawOrderBy('createdAt')).toBe('createdAt');
    expect(sanitizeRawOrderBy('session.created_at')).toBe('session.created_at');
    expect(sanitizeRawOrderBy('"createdAt"')).toBe('"createdAt"');
  });

  test('drops the proven injection expressions', () => {
    expect(sanitizeRawOrderBy('(select count(*) from pg_sleep(3))')).toBeUndefined();
    expect(
      sanitizeRawOrderBy('(case when (select count(*) from "user") > 0 then username end)'),
    ).toBeUndefined();
  });

  test('drops expressions, keywords and empty values', () => {
    expect(sanitizeRawOrderBy('created_at desc')).toBeUndefined();
    expect(sanitizeRawOrderBy('max(created_at)')).toBeUndefined();
    expect(sanitizeRawOrderBy('1; drop table "user"')).toBeUndefined();
    expect(sanitizeRawOrderBy('')).toBeUndefined();
    expect(sanitizeRawOrderBy(undefined)).toBeUndefined();
    expect(sanitizeRawOrderBy(null)).toBeUndefined();
  });
});
