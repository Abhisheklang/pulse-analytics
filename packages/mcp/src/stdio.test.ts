import { describe, expect, test } from 'vitest';
import { resolveClientOptions } from './stdio';

describe('resolveClientOptions', () => {
  test('appends /api to a self-hosted instance URL', () => {
    expect(
      resolveClientOptions({ PULSE_URL: 'https://analytics.example.com/', PULSE_API_TOKEN: 't' }),
    ).toEqual({ baseUrl: 'https://analytics.example.com/api', token: 't', apiKey: undefined });
  });

  test('uses PULSE_API_URL verbatim', () => {
    expect(
      resolveClientOptions({ PULSE_API_URL: 'https://pulse.example.com/api', PULSE_API_KEY: 'k' }),
    ).toEqual({ baseUrl: 'https://pulse.example.com/api', token: undefined, apiKey: 'k' });
  });

  test('leaves baseUrl unset when only an API key is provided', () => {
    expect(resolveClientOptions({ PULSE_API_KEY: 'k' }).baseUrl).toBeUndefined();
  });

  test('requires credentials', () => {
    expect(() => resolveClientOptions({})).toThrow(/PULSE_API_TOKEN/);
  });
});
