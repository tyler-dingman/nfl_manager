import { Storage, objectKey, digest, type Objects } from './core';
/** Unpublished immutable preparation; SQL visibility remains guarded by the caller. */
export function stageObjects(s: Storage) {
  const pending = new Map<string, Uint8Array>();
  const objects: Objects = {
    compactTrees: s.objects.compactTrees,
    transactionDatabase: () => s.db,
    get: async (key) => pending.get(key)?.slice() ?? (await s.objects.get(key)),
    putImmutable: async (key, bytes) => {
      if (key !== objectKey(await digest(bytes))) throw Error('Staged digest mismatch');
      pending.set(key, bytes.slice());
    },
  };
  return {
    storage: new Storage(s.db, objects),
    async flush() {
      if (s.objects.putManyImmutable)
        await s.objects.putManyImmutable([...pending].map(([key, bytes]) => ({ key, bytes })));
      else for (const [key, bytes] of pending) await s.objects.putImmutable(key, bytes);
    },
  };
}
