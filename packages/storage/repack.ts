import { digest, type SqlDatabase } from './core';
import { decodeObject } from './codec';
/** Owner-local maintenance. Mixed old/new chunks are readable throughout a
 * crash, and original hashes, admission reservations and references never change. */
export async function repackLegacyPayload(
  raw: SqlDatabase,
  hash: string,
  acknowledge: 'OWNER_MAINTENANCE_RAW_WRITERS_STOPPED',
  target: 'binary' | 'base64' = 'binary',
) {
  if (acknowledge !== 'OWNER_MAINTENANCE_RAW_WRITERS_STOPPED' || !/^[a-f0-9]{64}$/.test(hash))
    throw Error('Invalid maintenance request');
  await raw.prepare('INSERT OR IGNORE INTO app_storage_epoch(id,epoch,locked) VALUES(1,0,0)').run();
  const lock = await raw
    .prepare('UPDATE app_storage_epoch SET epoch=epoch+1,locked=1 WHERE id=1 AND locked=0')
    .run();
  if (lock.meta.changes !== 1) throw Error('Storage maintenance already locked');
  try {
    const head = await raw
      .prepare('SELECT bytes,chunks,complete FROM app_payload_objects WHERE hash=?')
      .bind(hash)
      .first<{ bytes: number; chunks: number; complete: number }>();
    if (!head?.complete) throw Error('Complete object required');
    const result = await raw
      .prepare('SELECT ordinal,body,data FROM app_payload_chunks WHERE hash=? ORDER BY ordinal')
      .bind(hash)
      .all<{ ordinal: number; body: string; data: number[] | ArrayBuffer | null }>();
    if (!result.success || result.results.length !== head.chunks)
      throw Error('Incomplete chunk set');
    const stored = new Uint8Array(head.bytes);
    let offset = 0;
    for (const [i, row] of result.results.entries()) {
      if (row.ordinal !== i) throw Error('Invalid chunk order');
      const bytes =
        row.data == null
          ? Uint8Array.from(atob(row.body), (c) => c.charCodeAt(0))
          : new Uint8Array(row.data as ArrayBuffer);
      stored.set(bytes, offset);
      offset += bytes.length;
    }
    if (offset !== head.bytes || (await digest(await decodeObject(stored, hash))) !== hash)
      throw Error('Object integrity failure');
    const statements =
      target === 'base64'
        ? result.results
            .filter((r) => r.data !== null)
            .map((r) =>
              raw
                .prepare(
                  'UPDATE app_payload_chunks SET body=?,data=NULL WHERE hash=? AND ordinal=? AND data IS NOT NULL',
                )
                .bind(
                  btoa(String.fromCharCode(...new Uint8Array(r.data as ArrayBuffer))),
                  hash,
                  r.ordinal,
                ),
            )
        : result.results
            .filter((r) => r.data == null)
            .map((r) =>
              raw
                .prepare(
                  "UPDATE app_payload_chunks SET data=?,body='' WHERE hash=? AND ordinal=? AND body=? AND data IS NULL",
                )
                .bind(
                  Uint8Array.from(atob(r.body), (c) => c.charCodeAt(0)).buffer,
                  hash,
                  r.ordinal,
                  r.body,
                ),
            );
    for (let i = 0; i < statements.length; i += 20) {
      const updated = await raw.batch(statements.slice(i, i + 20));
      if (updated.some((r) => !r.success)) throw Error('Repack failed');
    }
    return {
      hash,
      convertedChunks: statements.length,
      target,
      encodedBytesUnchanged: head.bytes,
      physicalBytesReclaimed: null,
    };
  } finally {
    await raw.prepare('UPDATE app_storage_epoch SET locked=0 WHERE id=1').run();
  }
}
