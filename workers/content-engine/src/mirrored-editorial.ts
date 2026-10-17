import { sha, type PrivateArchiveObjects } from './r2-archive';
/** Two caller-supplied private object stores. No public endpoint, provisioning, overwrite or delete. */
export class MirroredEditorialObjects implements PrivateArchiveObjects {
  degradedReads = 0;
  constructor(
    readonly primary: PrivateArchiveObjects,
    readonly backup: PrivateArchiveObjects,
  ) {}
  private digest(key: string) {
    const match = /editorial\/lean\/v1\/([a-f0-9]{64})\.json$/.exec(key);
    if (!match) throw Error('Invalid mirrored editorial key');
    return match[1];
  }
  async get(key: string) {
    const expected = this.digest(key);
    let bytes: Uint8Array | null = null;
    try {
      bytes = await this.primary.get(key);
    } catch {
      /* Validated fallback records degraded availability. */
    }
    if (bytes && (await sha(bytes)) === expected) return bytes;
    this.degradedReads++;
    const fallback = await this.backup.get(key);
    if (!fallback || (await sha(fallback)) !== expected)
      throw Error('Both editorial copies unavailable or corrupt');
    return fallback;
  }
  async putImmutable(key: string, bytes: Uint8Array) {
    const expected = this.digest(key);
    if ((await sha(bytes)) !== expected) throw Error('Mirrored payload checksum failed');
    await this.primary.putImmutable(key, bytes);
    await this.backup.putImmutable(key, bytes);
    for (const store of [this.primary, this.backup]) {
      const copy = await store.get(key);
      if (!copy || (await sha(copy)) !== expected) throw Error('Mirror verification failed');
    }
  }
}
