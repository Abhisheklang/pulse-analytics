import { describe, expect, it } from 'vitest';
import { CHART_COLORS } from '@/lib/constants';
import {
  DEFAULT_PULSE_THEME,
  PULSE_THEME_IDS,
  PULSE_THEMES,
  getPulseTheme,
  isPulseThemeId,
} from '../themes';

const HEX = /^#[0-9a-f]{6}$/i;

describe('Pulse colour theme presets', () => {
  it('ships at least the five named presets', () => {
    expect(PULSE_THEME_IDS).toEqual(
      expect.arrayContaining(['midnight', 'ocean', 'sunset', 'forest', 'slate']),
    );
  });

  it('defaults to Midnight Pulse', () => {
    expect(DEFAULT_PULSE_THEME).toBe('midnight');
    expect(getPulseTheme().id).toBe('midnight');
    expect(getPulseTheme('does-not-exist').id).toBe('midnight');
    expect(getPulseTheme(null).id).toBe('midnight');
  });

  it('every preset defines a complete palette', () => {
    for (const id of PULSE_THEME_IDS) {
      const preset = PULSE_THEMES[id];
      expect(preset.id).toBe(id);
      expect(preset.name.length).toBeGreaterThan(0);
      expect(preset.primary).toMatch(HEX);
      expect(preset.primaryDark).toMatch(HEX);
      expect(preset.chartColors).toHaveLength(12);
      for (const color of preset.chartColors) {
        expect(color).toMatch(HEX);
      }
      // First chart series colour is the preset primary.
      expect(preset.chartColors[0]).toBe(preset.primary);
      expect(preset.swatches).toHaveLength(3);
      for (const color of preset.swatches) {
        expect(color).toMatch(HEX);
      }
    }
  });

  it('presets are visually distinct from each other', () => {
    const primaries = PULSE_THEME_IDS.map(id => PULSE_THEMES[id].primary);
    expect(new Set(primaries).size).toBe(primaries.length);
  });

  it('Midnight Pulse matches the historical brand palette', () => {
    expect(PULSE_THEMES.midnight.primary).toBe('#4f46e5');
    expect(PULSE_THEMES.midnight.chartColors).toEqual(CHART_COLORS);
  });

  it('validates preset ids', () => {
    expect(isPulseThemeId('ocean')).toBe(true);
    expect(isPulseThemeId('nope')).toBe(false);
    expect(isPulseThemeId(undefined)).toBe(false);
    expect(isPulseThemeId(42)).toBe(false);
  });
});
