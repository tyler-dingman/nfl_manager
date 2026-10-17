import type { Meter } from './types';
export class EditorialDatabase {
  readonly measurements: Meter[] = [];
  resolveArchive?: (stored: string) => Promise<string>;
  resolveBlob?: (hash: string) => Promise<Uint8Array | null>;
  resolveJson?: (stored: string) => Promise<string>;
  constructor(readonly binding: D1Database) {}
  statement(sql: string, values: unknown[] = []): D1PreparedStatement {
    if (values.length > 100) throw Error('D1 parameter budget exceeded');
    return this.binding.prepare(sql).bind(...values);
  }
  private record(label: string, results: D1Result[]) {
    if (results.some((result) => !result.success)) throw Error('D1 operation failed');
    this.measurements.push({
      label,
      statements: results.length,
      rowsRead: results.reduce((s, r) => s + (r.meta.rows_read ?? 0), 0),
      rowsWritten: results.reduce((s, r) => s + (r.meta.rows_written ?? 0), 0),
      durationMs: results.reduce((s, r) => s + (r.meta.duration ?? 0), 0),
    });
  }
  async query<T>(label: string, sql: string, values: unknown[] = [], expand = true): Promise<T[]> {
    const result = await this.statement(sql, values).all<T>();
    this.record(label, [result]);
    if (!expand) return result.results;
    for (const row of result.results as Record<string, unknown>[])
      for (const [key, value] of Object.entries(row)) {
        if (typeof value === 'string' && value.startsWith('{"$archive":"dd-private-r2-v1"')) {
          if (!this.resolveArchive) throw Error('Private archive reader is required');
          row[key] = await this.resolveArchive(value);
        } else if (
          typeof value === 'string' &&
          value.startsWith('{"$storage":"dd-editorial-payload-v1"')
        ) {
          if (!this.resolveJson) throw Error('Compact editorial reader is required');
          row[key] = await this.resolveJson(value);
        }
      }
    return result.results;
  }
  async batch(label: string, statements: D1PreparedStatement[]): Promise<D1Result[]> {
    if (statements.length > 50) throw Error('D1 statement budget exceeded');
    const results = await this.binding.batch(statements);
    this.record(label, results);
    return results;
  }
  guard(token: string) {
    return this.statement('INSERT INTO transaction_assertions(token,value) VALUES(?,changes())', [
      token,
    ]);
  }
  unguard(token: string) {
    return this.statement('DELETE FROM transaction_assertions WHERE token=?', [token]);
  }
}
export function text(value: unknown): string {
  if (typeof value !== 'string' || !value.length || value.length > 2048)
    throw Error('Invalid text identifier');
  return value;
}
export function integer(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0) throw Error('Invalid nonnegative integer');
  return value as number;
}
export function json(value: unknown): string {
  const result = JSON.stringify(value);
  if (!result || new TextEncoder().encode(result).length > 512_000)
    throw Error('POC JSON record limit: 512 KB');
  return result;
}
export async function hash(value: unknown): Promise<string> {
  function canonical(v: unknown): unknown {
    if (Array.isArray(v)) return v.map(canonical);
    if (v && typeof v === 'object')
      return Object.fromEntries(
        Object.entries(v)
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([k, x]) => [k, canonical(x)]),
      );
    return v;
  }
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(json(canonical(value))),
  );
  return Array.from(new Uint8Array(digest), (x) => x.toString(16).padStart(2, '0')).join('');
}
export function canonicalUrl(value: string): string {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
    throw Error('Invalid editorial URL');
  url.hash = '';
  for (const key of [...url.searchParams.keys()])
    if (/^utm_/i.test(key) || ['fbclid', 'gclid'].includes(key)) url.searchParams.delete(key);
  url.searchParams.sort();
  return url.toString();
}
