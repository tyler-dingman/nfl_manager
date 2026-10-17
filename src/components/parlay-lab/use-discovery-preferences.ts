'use client';
import { useEffect, useSyncExternalStore } from 'react';
import {
  createDiscoveryPreferenceStore,
  DISCOVERY_STORAGE_KEY,
} from '../../../packages/parlay/discovery-preferences';
const store = createDiscoveryPreferenceStore({
  get: () => localStorage.getItem(DISCOVERY_STORAGE_KEY),
  set: (value) => localStorage.setItem(DISCOVERY_STORAGE_KEY, value),
});
export function useDiscoveryPreferences() {
  const value = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  useEffect(() => {
    void store.hydrate();
    const receive = (e: StorageEvent) => {
      if (e.key === DISCOVERY_STORAGE_KEY) store.receive(e.newValue);
    };
    window.addEventListener('storage', receive);
    return () => window.removeEventListener('storage', receive);
  }, []);
  return { ...value, update: store.update };
}
