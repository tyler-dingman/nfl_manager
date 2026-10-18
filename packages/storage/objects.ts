import { digest, objectKey, type Objects } from './core';
export interface Bucket {
  get(key: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer>; size: number } | null>;
  put(key: string, bytes: Uint8Array, options?: unknown): Promise<unknown>;
}
export class PrivateObjects implements Objects {
  reads = 0;
  writes = 0;
  bytes = 0;
  constructor(
    readonly primary: Bucket,
    readonly backup?: Bucket,
  ) {}
  async read(bucket: Bucket, key: string) {
    this.reads++;
    const value = await bucket.get(key);
    if (!value) return null;
    if (value.size > 4_000_000) throw Error('Application object limit');
    const bytes = new Uint8Array(await value.arrayBuffer());
    return (await digest(bytes)) === key.split('/').at(-1) ? bytes : null;
  }
  async get(key: string) {
    if (objectKey(key.split('/').at(-1)!) !== key) throw Error('Invalid application object key');
    let first: Uint8Array | null = null;
    try {
      first = await this.read(this.primary, key);
    } catch {}
    if (first) return first;
    if (this.backup) return this.read(this.backup, key);
    return null;
  }
  async putImmutable(key: string, bytes: Uint8Array) {
    if (objectKey(await digest(bytes)) !== key || bytes.length > 4_000_000)
      throw Error('Invalid immutable application object');
    for (const store of this.backup ? [this.primary, this.backup] : [this.primary]) {
      this.reads++;
      const prior = await store.get(key);
      if (prior) {
        const raw = new Uint8Array(await prior.arrayBuffer());
        if ((await digest(raw)) !== (await digest(bytes)))
          throw Error('Immutable collision or corruption');
      } else {
        this.writes++;
        this.bytes += bytes.length;
        await store.put(key, bytes, { onlyIf: { etagDoesNotMatch: '*' } });
      }
      const verified = await this.read(store, key);
      if (!verified) throw Error('Immutable verification failed');
    }
  }
}
