import { describe, expect, it } from 'vitest';
import { twoProportionZTest } from '../experiments';

// The seeded demo experiment: control 10 conversions / 100 exposures vs
// variant 22 / 100. Known result (verified against the live API in wave 3):
// z = 2.3146, p = 0.0206 (two-tailed), significant at the 0.05 level.
describe('twoProportionZTest', () => {
  it('matches the seeded experiment statistics', () => {
    const r = twoProportionZTest(10, 100, 22, 100);
    expect(r).not.toBeNull();
    expect(r!.z).toBeCloseTo(2.3146, 3);
    expect(r!.p).toBeCloseTo(0.0206, 3);
    expect(r!.p).toBeLessThan(0.05);
  });

  it('equal rates give z = 0 and p = 1', () => {
    const r = twoProportionZTest(10, 100, 10, 100);
    expect(r).not.toBeNull();
    expect(r!.z).toBeCloseTo(0, 10);
    expect(r!.p).toBeCloseTo(1, 4);
  });

  it('a reversed effect flips the sign of z', () => {
    const r = twoProportionZTest(22, 100, 10, 100);
    expect(r!.z).toBeCloseTo(-2.3146, 3);
    expect(r!.p).toBeCloseTo(0.0206, 3);
  });

  it('small samples are not significant', () => {
    const r = twoProportionZTest(1, 10, 3, 10);
    expect(r!.p).toBeGreaterThan(0.05);
  });

  it('zero exposures return null instead of dividing by zero', () => {
    expect(twoProportionZTest(0, 0, 5, 10)).toBeNull();
    expect(twoProportionZTest(0, 100, 0, 100)).toBeNull();
  });
});
