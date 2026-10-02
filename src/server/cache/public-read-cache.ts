/** Bounded, process-local cache for public reference data only. Never use for auth or permissions. */
export function cachePublicRead<A extends unknown[], T>(
  read: (...args: A) => Promise<T>,
  { ttlMs = 60_000, maxEntries = 32, now = Date.now } = {},
) {
  const entries = new Map<string, { expires: number; pending: Promise<T> }>();
  return async (...args: A): Promise<T> => {
    const key = JSON.stringify(args);
    let entry = entries.get(key);
    if (!entry || entry.expires <= now()) {
      if (entries.size >= maxEntries) entries.delete(entries.keys().next().value!);
      entry = { expires: Infinity, pending: Promise.resolve().then(() => read(...args)) };
      entries.set(key, entry);
      const current = entry;
      entry.pending = entry.pending.then(
        (value) => {
          current.expires = now() + ttlMs;
          return value;
        },
        (error) => {
          if (entries.get(key) === current) entries.delete(key);
          throw error;
        },
      );
    }
    // Callers may sort/filter/mutate these datasets; never expose shared cached objects.
    return structuredClone(await entry.pending);
  };
}
