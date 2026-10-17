/**
 * Single-owner public snapshot. The owner must not mutate a published value.
 * Fresh reads reuse it; stale reads coalesce one background refresh. After the
 * hard age limit callers must wait, so refresh failures cannot serve data forever.
 */
export function refreshingSnapshot<T>(
  read: () => Promise<T>,
  { freshMs = 60_000, maxAgeMs = 120_000, retryMs = 5_000, now = Date.now } = {},
) {
  let snapshot: { value: T; at: number } | undefined;
  let pending: Promise<T> | undefined;
  let retryAt = 0;
  function refresh() {
    if (!pending) {
      pending = Promise.resolve()
        .then(read)
        .then(
          (value) => {
            snapshot = { value, at: now() };
            retryAt = 0;
            return value;
          },
          (error) => {
            retryAt = now() + retryMs;
            throw error;
          },
        )
        .finally(() => {
          pending = undefined;
        });
    }
    return pending;
  }
  return async () => {
    if (!snapshot || now() - snapshot.at >= maxAgeMs) return refresh();
    if (now() - snapshot.at >= freshMs && now() >= retryAt)
      void refresh().catch(() => {
        /* last completed snapshot remains within hard age bound */
      });
    return snapshot.value;
  };
}
