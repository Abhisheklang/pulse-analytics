import { describe, expect, test } from 'vitest';
import { DOMAIN_REGEX } from './constants';

// Regression tests for P-ADV-1: DOMAIN_REGEX must validate domains in
// linear time. The old label alternative nested quantifiers and took
// >5 s on a 61-character near-miss input.
describe('DOMAIN_REGEX', () => {
  test('accepts legitimate domains', () => {
    for (const domain of [
      'example.com',
      'sub.example.co.uk',
      'xn--nxasmq6b.example.com',
      'a-b_c.example.com',
      'localhost',
      'localhost:8080',
      '-bad.com',
      'bad-.com',
      `${'a'.repeat(63)}.com`,
    ]) {
      expect(DOMAIN_REGEX.test(domain), domain).toBe(true);
    }
  });

  test('rejects invalid domains', () => {
    for (const domain of ['example.c', `${'a'.repeat(64)}.com`, 'exa mple.com', 'example..com']) {
      expect(DOMAIN_REGEX.test(domain), domain).toBe(false);
    }
  });

  test('validates the audit ReDoS inputs in flat time', () => {
    const inputs = [
      'a-'.repeat(10) + '.',
      'a-'.repeat(22) + '.',
      'a-'.repeat(30) + '.',
      ('a'.repeat(30) + '-'.repeat(30) + '.').repeat(3) + '!',
    ];

    for (const input of inputs) {
      const start = performance.now();
      expect(DOMAIN_REGEX.test(input)).toBe(false);
      expect(performance.now() - start).toBeLessThan(100);
    }
  });
});
