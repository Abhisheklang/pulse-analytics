'use client';
import { useTheme } from '@pulselytics/react-zen';
import { useEffect } from 'react';
import { COLOR_THEME_CONFIG, THEME_MODE_CONFIG } from '@/lib/constants';
import {
  DEFAULT_PULSE_THEME,
  getPulseTheme,
  isPulseThemeId,
} from '@/lib/pulse/themes';
import { getItem, setItem } from '@/lib/storage';
import { setColorTheme, setThemeMode, useApp } from '@/store/app';

const colorThemeSelector = (state: { colorTheme: string }) => state.colorTheme;
const themeModeSelector = (state: { themeMode: string | null }) => state.themeMode;

export type PulseThemeMode = 'light' | 'dark' | 'system';

/** Active Pulse colour preset + mode, backed by localStorage
 *  (`pulse.color-theme`, `pulse.theme-mode`) and mirrored into the app
 *  store so components re-render when either changes. */
export function usePulseTheme() {
  const colorTheme = useApp(colorThemeSelector);
  const themeMode = useApp(themeModeSelector);
  const { theme, setTheme } = useTheme();

  const mode: PulseThemeMode =
    themeMode === 'system' ? 'system' : theme === 'dark' ? 'dark' : 'light';

  function saveColorTheme(value: string) {
    const next = isPulseThemeId(value) ? value : DEFAULT_PULSE_THEME;
    setItem(COLOR_THEME_CONFIG, next);
    document.documentElement.setAttribute('data-pulse-theme', next);
    setColorTheme(next);
  }

  function saveThemeMode(value: PulseThemeMode) {
    setItem(THEME_MODE_CONFIG, value);
    setThemeMode(value);
    if (value === 'light' || value === 'dark') {
      setTheme(value);
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setTheme(prefersDark ? 'dark' : 'light');
    }
  }

  return { colorTheme, mode, saveColorTheme, saveThemeMode };
}

/** Chart palette for the active colour preset. Re-renders when the preset
 *  changes because it subscribes to the app store. */
export function useChartColors(): string[] {
  const colorTheme = useApp(colorThemeSelector);
  return getPulseTheme(colorTheme).chartColors;
}

/** Mounted once in Providers: keeps the `data-pulse-theme` attribute in sync
 *  with the store (the boot script in the root layout sets it before first
 *  paint) and, in System mode, follows the OS colour scheme live. */
export function PulseThemeManager() {
  const colorTheme = useApp(colorThemeSelector);
  const themeMode = useApp(themeModeSelector);
  const { setTheme } = useTheme();

  useEffect(() => {
    document.documentElement.setAttribute('data-pulse-theme', colorTheme);
  }, [colorTheme]);

  useEffect(() => {
    if (themeMode !== 'system') return;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => setTheme(query.matches ? 'dark' : 'light');
    apply();
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, [themeMode, setTheme]);

  return null;
}

export function getStoredColorTheme(): string {
  const stored = getItem(COLOR_THEME_CONFIG);
  return isPulseThemeId(stored) ? stored : DEFAULT_PULSE_THEME;
}
