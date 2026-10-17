import type { harness } from './harness';
import { BlobPacks } from '../src/blob-packs';
/** Quiesced disposable fixture only. Existing data cleanup is deliberately unavailable. */
export async function retireSyntheticBlobBodies(
  h: Awaited<ReturnType<typeof harness>>,
  packs: BlobPacks,
) {
  if (
    !h.directory.includes('/dd-editorial-synthetic-') ||
    !h.options.d1Databases.EDITORIAL_DB.startsWith('editorial-synthetic-')
  )
    throw Error('Synthetic cleanup guard');
  const rows = await h.db.query<any>(
    'synthetic.blob.copies',
    'SELECT b.* FROM editorial_blobs b WHERE b.pack_id IS NOT NULL',
    [],
    false,
  );
  for (const row of rows) {
    const remote = await packs.read(row.hash);
    let local = new Uint8Array(row.body);
    if (row.fragment_count) {
      const parts = await h.db.query<any>(
        'synthetic.blob.parts',
        'SELECT body FROM editorial_blob_fragments WHERE hash=? ORDER BY part',
        [row.hash],
        false,
      );
      const buffers = parts.map((p) => new Uint8Array(p.body));
      local = new Uint8Array(buffers.reduce((n, b) => n + b.length, 0));
      let at = 0;
      for (const b of buffers) {
        local.set(b, at);
        at += b.length;
      }
    }
    if (!remote || local.length !== remote.length || local.some((v, i) => v !== remote[i]))
      throw Error('Redundant body verification failed');
  }
  for (const row of rows)
    await h.db.batch('synthetic.blob.retire', [
      h.db.statement('DELETE FROM editorial_blob_fragments WHERE hash=?', [row.hash]),
      h.db.statement('UPDATE editorial_blobs SET body=?,fragment_count=0 WHERE hash=?', [
        new ArrayBuffer(0),
        row.hash,
      ]),
    ]);
  return rows.length;
}
