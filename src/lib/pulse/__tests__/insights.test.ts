import { describe, expect, it } from 'vitest';
import { pickTopDriver } from '../insights';

describe('pickTopDriver', () => {
  it("never picks '(direct)' even when its growth is largest", () => {
    const cur = new Map([
      ['(direct)', 100],
      ['google.com', 10],
    ]);
    const prev = new Map([
      ['(direct)', 10],
      ['google.com', 2],
    ]);
    const best = pickTopDriver(cur, prev);
    expect(best).toEqual({ name: 'google.com', delta: 8, cur: 10, prev: 2 });
  });

  it('returns null when nothing grew', () => {
    const cur = new Map([['google.com', 5]]);
    const prev = new Map([['google.com', 9]]);
    expect(pickTopDriver(cur, prev)).toBeNull();
  });

  it('treats names missing from the previous period as zero', () => {
    const cur = new Map([['news.ycombinator.com', 7]]);
    const best = pickTopDriver(cur, new Map());
    expect(best?.name).toBe('news.ycombinator.com');
    expect(best?.prev).toBe(0);
  });
});
