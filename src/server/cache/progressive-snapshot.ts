/** Coalesced builds expose initial progress, but never replace a complete snapshot
 * with partial refresh results. Failed/expired builds cannot remain authoritative. */
function createProgressiveSnapshot<T>(
  build: (publish: (value: T) => void) => Promise<T>,
  { freshMs = 60_000, maxAgeMs = 120_000, now = Date.now } = {},
) {
  let current: { value: T; at: number; complete: boolean } | undefined;
  let running: Promise<T> | undefined;
  let first: Promise<T> | undefined;
  let failure: unknown;
  let retryAt = 0;
  function start() {
    failure = undefined;
    let resolve!: (value: T) => void;
    let reject!: (error: unknown) => void;
    first = new Promise<T>((yes, no) => {
      resolve = yes;
      reject = no;
    });
    // A background refresh has no first-result waiter.
    void first.catch(() => {});
    running = Promise.resolve()
      .then(() =>
        build((value) => {
          if (!current?.complete) {
            current = { value, at: now(), complete: false };
            resolve(value);
          }
        }),
      )
      .then((value) => {
        current = { value, at: now(), complete: true };
        resolve(value);
        return value;
      })
      .catch((error) => {
        failure = error;
        retryAt = now() + 5_000;
        if (!current?.complete) current = undefined;
        reject(error);
        throw error;
      })
      .finally(() => {
        running = undefined;
      });
    void running.catch(() => {});
  }
  return async () => {
    if (current?.complete && now() - current.at >= maxAgeMs) current = undefined;
    if (failure && !current && now() < retryAt) throw failure;
    if (!running && (!current || now() - current.at >= freshMs) && now() >= retryAt) start();
    if (current) return current.value;
    return first!;
  };
}

/** Separate public snapshots for isolated persistence sources. */
export function progressiveSnapshot<T>(
  build: (publish: (value: T) => void) => Promise<T>,
  options: { freshMs?: number; maxAgeMs?: number; now?: () => number; scope?: () => string } = {},
) {
  const instances = new Map<string, ReturnType<typeof createProgressiveSnapshot<T>>>();
  return () => {
    const key = options.scope?.() ?? '';
    let read = instances.get(key);
    if (!read) {
      if (instances.size >= 8) instances.delete(instances.keys().next().value!);
      read = createProgressiveSnapshot(build, options);
      instances.set(key, read);
    }
    return read();
  };
}
