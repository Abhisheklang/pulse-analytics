'use client';
import { useEffect } from 'react';
import { ANIMATIONS_CONFIG } from '@/lib/constants';
import { getItem, setItem } from '@/lib/storage';
import { setAnimations, useApp } from '@/store/app';

const animationsSelector = (state: { animations: string }) => state.animations;

export type PulseAnimations = 'on' | 'off';

/** Whether the Pulse motion layer (entrances, staggers, hover lifts,
 *  scroll reveals, chart animation) is active. Backed by localStorage
 *  (`pulse.animations`) and mirrored into the app store. Unset means on,
 *  unless the OS prefers reduced motion — then off until the user
 *  explicitly turns animations on; an explicit choice always wins. */
export function usePulseMotion() {
  const animations = useApp(animationsSelector) as PulseAnimations;

  function saveAnimations(value: PulseAnimations) {
    setItem(ANIMATIONS_CONFIG, value);
    document.documentElement.setAttribute('data-pulse-motion', value);
    setAnimations(value);
  }

  return { animations, saveAnimations };
}

/** Mounted once in Providers: keeps the `data-pulse-motion` attribute in
 *  sync with the store (the boot script in the root layout sets it before
 *  first paint, so there is no flash of animation when it is off). */
export function PulseMotionManager() {
  const animations = useApp(animationsSelector);

  useEffect(() => {
    document.documentElement.setAttribute('data-pulse-motion', animations);
  }, [animations]);

  return null;
}

export function getStoredAnimations(): PulseAnimations | null {
  const stored = getItem(ANIMATIONS_CONFIG);
  return stored === 'on' || stored === 'off' ? stored : null;
}

/** Effective motion state for imperative consumers (Reveal, charts):
 *  the data-pulse-motion attribute the boot script sets pre-paint is
 *  the source of truth; fall back to the OS preference if it is absent. */
export function isMotionOff(): boolean {
  if (typeof document === 'undefined') return false;
  const attr = document.documentElement.getAttribute('data-pulse-motion');
  if (attr) return attr === 'off';
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}
