import { describe, expect, it } from 'vitest';
import { badgeSvg } from '../badge';

function widthOf(svg: string): number {
  const m = svg.match(/width="(\d+)"/);
  if (!m) throw new Error('no width attribute');
  return Number(m[1]);
}

describe('badgeSvg', () => {
  it('renders an SVG with the label and value', () => {
    const svg = badgeSvg('pulse visitors today', '3 · 12 views');
    expect(svg).toContain('<svg');
    expect(svg).toContain('pulse visitors today');
    expect(svg).toContain('3 · 12 views');
  });

  it('width grows with value length (~7px per character)', () => {
    const short = widthOf(badgeSvg('pulse visitors today', '1'));
    const long = widthOf(badgeSvg('pulse visitors today', '123456789'));
    expect(long).toBeGreaterThan(short);
    expect(long - short).toBe(8 * 7);
  });

  it('width grows with label length too', () => {
    const a = widthOf(badgeSvg('a', '1'));
    const b = widthOf(badgeSvg('aaaaa', '1'));
    expect(b - a).toBe(4 * 7);
  });
});
