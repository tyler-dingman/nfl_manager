/** Public odds/research only; never use this cache for account or authorization responses. */
export function createResearchRequestCache<T>(
  read: (url: string) => Promise<T>,
  now = Date.now,
  ttl: (value: T) => number = () => 60_000,
) {
  const entries = new Map<string, { expires: number; promise: Promise<T> }>();
  return (url: string) => {
    const existing = entries.get(url);
    if (existing && existing.expires > now()) return existing.promise;
    if (entries.size >= 6) entries.delete(entries.keys().next().value!);
    const entry = { expires: Infinity, promise: Promise.resolve().then(() => read(url)) };
    entries.set(url, entry);
    entry.promise = entry.promise.then(
      (value) => {
        entry.expires = now() + ttl(value);
        return value;
      },
      (error) => {
        if (entries.get(url) === entry) entries.delete(url);
        throw error;
      },
    );
    return entry.promise;
  };
}
