import { describe, expect, it } from 'vitest';
import { deriveSigV4SigningKey, sha256Hex } from '../exporter';

// AWS publishes this key-derivation example in the Signature Version 4
// documentation (secret from the AWS test suite; date 20150830, region
// us-east-1, service iam):
//   kSigning = c4afb1cc5771d871763a393e44b703571b55cc28424d1a5e86da6ed3c154a4b9
describe('deriveSigV4SigningKey', () => {
  it('matches the AWS-documented derivation example', () => {
    const key = deriveSigV4SigningKey(
      'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY',
      '20150830',
      'us-east-1',
      'iam',
    );
    expect(key.toString('hex')).toBe(
      'c4afb1cc5771d871763a393e44b703571b55cc28424d1a5e86da6ed3c154a4b9',
    );
  });

  it('is sensitive to region and service', () => {
    const a = deriveSigV4SigningKey('secret', '20260101', 'us-east-1', 's3');
    const b = deriveSigV4SigningKey('secret', '20260101', 'eu-west-1', 's3');
    const c = deriveSigV4SigningKey('secret', '20260101', 'us-east-1', 'iam');
    expect(a.equals(b)).toBe(false);
    expect(a.equals(c)).toBe(false);
  });
});

describe('sha256Hex', () => {
  it('hashes the empty string to the well-known digest', () => {
    expect(sha256Hex('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });
});
