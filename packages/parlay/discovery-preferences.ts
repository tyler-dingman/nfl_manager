export const DISCOVERY_STORAGE_KEY = 'down-distance-parlay-discovery-v1';
export const MAX_ALT_ODDS = [
  -200, -250, -300, -350, -400, -500, -600, -700, -800, -900, -1000,
] as const;
export type DiscoveryPreferences = { altLines: boolean; maxOdds: number };
export const DEFAULT_DISCOVERY: Readonly<DiscoveryPreferences> = {
  altLines: false,
  maxOdds: -1000,
};
export const DISCOVERY_SERVER_SNAPSHOT = { ...DEFAULT_DISCOVERY, ready: false };
export function parseDiscoveryPreferences(raw: string | null): DiscoveryPreferences {
  try {
    const value = JSON.parse(raw ?? '{}');
    return {
      altLines: value?.altLines === true,
      maxOdds: MAX_ALT_ODDS.includes(value?.maxOdds) ? value.maxOdds : -1000,
    };
  } catch {
    return { ...DEFAULT_DISCOVERY };
  }
}
/** One store per renderer. Async native storage and synchronous web storage share hydration semantics. */
export function createDiscoveryPreferenceStore(storage: {
  get(): string | null | Promise<string | null>;
  set(value: string): unknown;
}) {
  let snapshot = DISCOVERY_SERVER_SNAPSHOT;
  let hydrating: Promise<void> | undefined;
  let writes = Promise.resolve();
  let revision = 0;
  const listeners = new Set<() => void>();
  const publish = (preferences: DiscoveryPreferences) => {
    snapshot = { ...preferences, ready: true };
    listeners.forEach((l) => l());
  };
  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => DISCOVERY_SERVER_SNAPSHOT,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    hydrate() {
      if (!hydrating) {
        const before = revision;
        hydrating = Promise.resolve()
          .then(() => storage.get())
          .then((raw) => {
            if (revision === before) publish(parseDiscoveryPreferences(raw));
          })
          .catch(() => {
            if (revision === before) publish({ ...DEFAULT_DISCOVERY });
          });
      }
      return hydrating;
    },
    update(patch: Partial<DiscoveryPreferences>) {
      revision++;
      const next = parseDiscoveryPreferences(JSON.stringify({ ...snapshot, ...patch }));
      publish(next);
      writes = writes
        .then(() => storage.set(JSON.stringify(next)))
        .then(() => undefined)
        .catch(() => undefined);
      return writes;
    },
    receive(raw: string | null) {
      revision++;
      publish(parseDiscoveryPreferences(raw));
    },
  };
}
