import { useEffect, useSyncExternalStore } from 'react';
import { deviceStorage } from './device-storage';
import {
  createDiscoveryPreferenceStore,
  DISCOVERY_STORAGE_KEY,
} from '../../../packages/parlay/discovery-preferences';
const store = createDiscoveryPreferenceStore({
  get: () => deviceStorage.get(DISCOVERY_STORAGE_KEY),
  set: (value) => deviceStorage.set(DISCOVERY_STORAGE_KEY, value),
});
export function useDiscoveryPreferences() {
  const value = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  useEffect(() => {
    void store.hydrate();
  }, []);
  return { ...value, update: store.update };
}
