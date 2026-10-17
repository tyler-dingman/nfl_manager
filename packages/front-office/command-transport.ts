/** Platform-independent command metadata. No private state is sent to public caches. */
export function createFranchiseTransport(newId: () => string) {
  const versions = new Map<string, number>();
  const recordSaves = new Map<string, string>();
  const pending = new Map<string, { id: string; version?: number; saveId?: string }>();
  const isFranchise = (path: string) =>
    /^\/api\/(?:saves|roster|free-agents|draft|trades|trade-offers|trade-block|actions|franchise|front-office|contracts\/expiring|news)(?:\/|\?|$)/.test(
      path,
    );
  function prepare(path: string, init: RequestInit = {}) {
    if (!isFranchise(path)) return { init, key: undefined };
    const method = (init.method ?? 'GET').toUpperCase();
    let body: any = {};
    try {
      body = typeof init.body === 'string' ? JSON.parse(init.body) : {};
    } catch {
      /* Server validates malformed payloads. */
    }
    const url = new URL(path, 'https://franchise.invalid');
    const pathSave = url.pathname
      .split('/')
      .map((part) => recordSaves.get(decodeURIComponent(part)))
      .find(Boolean);
    const saveId = body?.saveId ?? url.searchParams.get('saveId') ?? pathSave;
    if (method === 'GET' || method === 'HEAD') {
      const headers = new Headers(init.headers);
      if (saveId) headers.set('X-Franchise-Id', saveId);
      return { init: { ...init, headers }, key: undefined };
    }
    const key = `${method}:${path}:${typeof init.body === 'string' ? init.body : ''}`;
    let command = pending.get(key);
    if (!command) {
      if (pending.size >= 64)
        throw new Error('Resolve pending franchise commands before starting more actions.');
      command = {
        id: newId(),
        saveId,
        version: url.pathname === '/api/saves/create' ? 0 : versions.get(saveId),
      };
      pending.set(key, command);
    }
    const headers = new Headers(init.headers);
    if (!headers.has('X-Franchise-Command-Id')) headers.set('X-Franchise-Command-Id', command.id);
    if (!headers.has('X-Franchise-Version') && command.version !== undefined)
      headers.set('X-Franchise-Version', String(command.version));
    if (saveId && !headers.has('X-Franchise-Id')) headers.set('X-Franchise-Id', saveId);
    return { init: { ...init, headers }, key };
  }
  async function observe(path: string, response: Response, key?: string) {
    if (!isFranchise(path)) return;
    const saveId = response.headers.get('X-Franchise-Id'),
      raw = response.headers.get('X-Franchise-Version');
    const version = raw === null ? NaN : Number(raw);
    if (saveId && Number.isSafeInteger(version))
      versions.set(saveId, Math.max(version, versions.get(saveId) ?? 0));
    if (response.ok && saveId) {
      const body = await response
        .clone()
        .json()
        .catch(() => null);
      function remember(value: any, depth = 0) {
        if (depth > 4 || !value || typeof value !== 'object') return;
        if (typeof value.id === 'string') recordSaves.set(value.id, saveId!);
        if (Array.isArray(value)) value.slice(0, 100).forEach((v) => remember(v, depth + 1));
        else
          for (const field of ['event', 'events', 'offer', 'offers', 'trade', 'session'])
            remember(value[field], depth + 1);
      }
      remember(body);
    }
    // A timeout/5xx is ambiguous: retain the exact ID and expected version for a retry.
    if (key && response.status < 500) pending.delete(key);
  }
  return {
    prepare,
    observe,
    reset() {
      versions.clear();
      recordSaves.clear();
      pending.clear();
    },
  };
}
export const webFranchiseTransport = createFranchiseTransport(() => globalThis.crypto.randomUUID());
