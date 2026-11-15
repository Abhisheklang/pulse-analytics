import { create } from 'zustand';
import { CURRENT_VERSION } from '@/lib/constants';

const initialState = {
  current: CURRENT_VERSION,
  latest: null,
  hasUpdate: false,
  checked: false,
  releaseUrl: null,
};

const store = create(() => ({ ...initialState }));

export async function checkVersion() {
  // Pulse Analytics: the upstream update check is disabled. This build never
  // contacts the original project's servers to look for new versions.
  return;
}

export const useVersion = store;
