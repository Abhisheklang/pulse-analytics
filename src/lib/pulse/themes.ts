// Pulse colour theme presets (redesign wave).
//
// Pure data + helpers — no DOM, no React — so the preset definitions can be
// unit-tested. The active preset is applied two ways:
//   1. CSS: a `data-pulse-theme` attribute on <html> switches the
//      `--zen-primary` (and related) variables in global.css.
//   2. JS: chart components read the palette for the active preset via
//      `getPulseTheme(...)` / the `useChartColors` hook, and the main chart
//      colour source (`getThemeColors` in lib/colors) reads the preset
//      primary from the DOM attribute.
//
// The default preset, Midnight Pulse, intentionally matches the historical
// brand values (BRANDING.md) and the CHART_COLORS array in lib/constants.

export interface PulseThemePreset {
  id: string;
  name: string;
  description: string;
  /** Accent used in light mode. */
  primary: string;
  /** Accent used in dark mode (lifted for contrast on dark surfaces). */
  primaryDark: string;
  /** 12 data colours; index 0 is the primary series colour. Secondary
   *  series are deliberately calmer / more desaturated than the primary. */
  chartColors: string[];
  /** Three representative swatches for the settings picker. */
  swatches: string[];
}

export const DEFAULT_PULSE_THEME = 'midnight';

export const PULSE_THEMES: Record<string, PulseThemePreset> = {
  midnight: {
    id: 'midnight',
    name: 'Midnight Pulse',
    description: 'Indigo and violet — the original Pulse identity.',
    primary: '#4f46e5',
    primaryDark: '#818cf8',
    chartColors: [
      '#4f46e5',
      '#7c3aed',
      '#0ea5e9',
      '#14b8a6',
      '#f59e0b',
      '#ec4899',
      '#22c55e',
      '#8b5cf6',
      '#06b6d4',
      '#f97316',
      '#a3e635',
      '#e879f9',
    ],
    swatches: ['#4f46e5', '#7c3aed', '#38bdf8'],
  },
  ocean: {
    id: 'ocean',
    name: 'Ocean',
    description: 'Deep blue and teal, calm and clinical.',
    primary: '#0284c7',
    primaryDark: '#38bdf8',
    chartColors: [
      '#0284c7',
      '#0891b2',
      '#0d9488',
      '#2563eb',
      '#38bdf8',
      '#2dd4bf',
      '#64748b',
      '#0369a1',
      '#14b8a6',
      '#7dd3fc',
      '#0e7490',
      '#5eead4',
    ],
    swatches: ['#0284c7', '#14b8a6', '#38bdf8'],
  },
  sunset: {
    id: 'sunset',
    name: 'Sunset',
    description: 'Warm rose and amber, energetic and friendly.',
    primary: '#e11d48',
    primaryDark: '#fb7185',
    chartColors: [
      '#e11d48',
      '#f59e0b',
      '#ea580c',
      '#f43f5e',
      '#fbbf24',
      '#fb923c',
      '#b45309',
      '#fda4af',
      '#fcd34d',
      '#9f1239',
      '#d97706',
      '#fca5a5',
    ],
    swatches: ['#e11d48', '#f59e0b', '#fb923c'],
  },
  forest: {
    id: 'forest',
    name: 'Forest',
    description: 'Emerald and leaf green, fresh and grounded.',
    primary: '#059669',
    primaryDark: '#34d399',
    chartColors: [
      '#059669',
      '#16a34a',
      '#65a30d',
      '#0d9488',
      '#34d399',
      '#4ade80',
      '#a3e635',
      '#166534',
      '#2dd4bf',
      '#86efac',
      '#15803d',
      '#bef264',
    ],
    swatches: ['#059669', '#65a30d', '#34d399'],
  },
  slate: {
    id: 'slate',
    name: 'Slate',
    description: 'Neutral monochrome with a single blue accent.',
    primary: '#2563eb',
    primaryDark: '#60a5fa',
    chartColors: [
      '#2563eb',
      '#475569',
      '#64748b',
      '#0ea5e9',
      '#334155',
      '#94a3b8',
      '#1d4ed8',
      '#6b7280',
      '#7dd3fc',
      '#525252',
      '#0369a1',
      '#a8a29e',
    ],
    swatches: ['#2563eb', '#475569', '#94a3b8'],
  },
};

export const PULSE_THEME_IDS = Object.keys(PULSE_THEMES);

export function isPulseThemeId(value: unknown): value is string {
  return typeof value === 'string' && value in PULSE_THEMES;
}

export function getPulseTheme(id?: string | null): PulseThemePreset {
  return (id && PULSE_THEMES[id]) || PULSE_THEMES[DEFAULT_PULSE_THEME];
}

/** CSS variables every preset must be able to drive. Used by tests to prove
 *  each preset is complete, and by the CSS layer in global.css. */
export const PULSE_THEME_VARIABLES = ['--zen-primary', '--pulse-accent'] as const;

/** Read the active preset id from the DOM (client only). Returns the default
 *  on the server or when no attribute is set. */
export function getActivePulseThemeId(): string {
  if (typeof document !== 'undefined') {
    const attr = document.documentElement.getAttribute('data-pulse-theme');
    if (isPulseThemeId(attr)) return attr;
  }
  return DEFAULT_PULSE_THEME;
}

export function getActivePulsePrimary(mode: 'light' | 'dark'): string {
  const preset = getPulseTheme(getActivePulseThemeId());
  return mode === 'dark' ? preset.primaryDark : preset.primary;
}
