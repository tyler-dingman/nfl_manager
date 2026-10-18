import { Storage, utf8 } from './core';
/** Server-owned tagged nodes; literal user fields are always wrapped as values.
 * Independent immutable subtrees share bytes across users and revisions. */
export class JsonTree {
  constructor(readonly s: Storage) {}
  async put(value: unknown): Promise<string> {
    const text = JSON.stringify(value);
    if (!text || utf8.encode(text).length > 4_000_000) throw Error('Application JSON tree limit');
    const write = async (v: any): Promise<string> => {
      const raw = JSON.stringify(v);
      const size = utf8.encode(raw).length;
      const object = v !== null && typeof v === 'object' && !Array.isArray(v);
      if (size <= 128000 && !(object && size > 32768)) return this.s.put(['v', v]);
      if (typeof v === 'string') {
        const parts: string[] = [];
        for (let i = 0; i < v.length; i += 64000) parts.push(await write(v.slice(i, i + 64000)));
        return this.s.put(['s', parts]);
      }
      if (Array.isArray(v)) {
        const parts: string[] = [];
        for (let i = 0; i < v.length; i += 256) parts.push(await write(v.slice(i, i + 256)));
        return this.s.put(['c', parts]);
      }
      const pairs: [string, string][] = [];
      for (const key of Object.keys(v).sort()) pairs.push([key, await write(v[key])]);
      return this.s.put(['o', pairs]);
    };
    // Match JSON semantics (undefined fields, dates, NaN) once at the boundary.
    return write(JSON.parse(text));
  }
  async get<T>(root: string): Promise<T> {
    const cache = new Map<string, Promise<unknown>>();
    let nodes = 0,
      bytes = 0;
    const read = async (hash: string, depth = 0): Promise<any> => {
      if (depth > 24) throw Error('Application tree depth limit');
      if (cache.has(hash)) return cache.get(hash);
      if (++nodes > 512) throw Error('Application tree node limit');
      const promise = (async () => {
        const node = await this.s.get<any>(hash);
        bytes += utf8.encode(JSON.stringify(node)).length;
        if (bytes > 8_000_000 || !Array.isArray(node) || node.length !== 2)
          throw Error('Invalid application tree');
        const [kind, value] = node;
        if (kind === 'v') return value;
        if (!Array.isArray(value)) throw Error('Invalid application tree node');
        if (kind === 's' || kind === 'c') {
          const parts = [];
          for (const child of value) parts.push(await read(child, depth + 1));
          if (kind === 's' && parts.every((p) => typeof p === 'string')) return parts.join('');
          if (kind === 'c' && parts.every(Array.isArray)) return parts.flat();
        }
        if (kind === 'o') {
          const entries: [string, unknown][] = [],
            seen = new Set<string>();
          for (const pair of value) {
            if (
              !Array.isArray(pair) ||
              pair.length !== 2 ||
              typeof pair[0] !== 'string' ||
              seen.has(pair[0])
            )
              throw Error('Invalid application tree property');
            seen.add(pair[0]);
            entries.push([pair[0], await read(pair[1], depth + 1)]);
          }
          return Object.fromEntries(entries);
        }
        throw Error('Unknown application tree node');
      })();
      cache.set(hash, promise);
      return promise;
    };
    const result = await read(root);
    const serialized = JSON.stringify(result);
    if (utf8.encode(serialized).length > 4_000_000) throw Error('Application JSON tree limit');
    return JSON.parse(serialized) as T;
  }
}
