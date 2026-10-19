import { publicContentPath } from './public-content-policy';
/** Bounded, anonymous public data only. Private paths always use the caller's transport. */
export function createPublicContentClient(transport: typeof fetch, now = Date.now) {
  const entries = new Map<string, { expires: number; response: Response }>();
  const pending = new Map<string, Promise<Response>>();
  return async (path: string): Promise<Response> => {
    const key = publicContentPath(path);
    if (!key) throw Error('Private or unsupported route cannot use public transport');
    const cached = entries.get(key);
    if (cached && now() < cached.expires) return cached.response.clone();
    entries.delete(key);
    const active = pending.get(key);
    if (active) return (await active).clone();
    if (pending.size >= 32)
      return transport(key, {
        method: 'GET',
        credentials: 'omit',
        headers: { Accept: 'application/json' },
      });
    const work = (async () => {
      const response = await transport(key, {
        method: 'GET',
        credentials: 'omit',
        headers: { Accept: 'application/json' },
      });
      if (
        response.status === 200 &&
        !response.headers.has('set-cookie') &&
        !/private|no-store/i.test(response.headers.get('cache-control') ?? '')
      ) {
        // Read a clone; retain at most 1 MiB and 32 entries. Never cache failures.
        const candidate = response.clone();
        const reader = candidate.body?.getReader();
        let bytes = 0;
        if (reader) {
          while (true) {
            const part = await reader.read();
            if (part.done) break;
            bytes += part.value.byteLength;
            if (bytes > 1024 * 1024) {
              void reader.cancel();
              break;
            }
          }
        }
        if (bytes <= 1024 * 1024) {
          if (entries.size >= 32) entries.delete(entries.keys().next().value!);
          const maxAge = Number(
            /(?:^|,)\s*max-age=(\d+)/i.exec(response.headers.get('cache-control') ?? '')?.[1] ?? 15,
          );
          const age = Number(response.headers.get('age') ?? 0);
          entries.set(key, {
            expires: now() + Math.min(15_000, Math.max(0, maxAge - age) * 1000),
            response: response.clone(),
          });
        }
      }
      return response;
    })();
    pending.set(key, work);
    try {
      return (await work).clone();
    } finally {
      pending.delete(key);
    }
  };
}
