import type { harness } from './harness';
import type { EditorialR2Archive } from '../src/r2-archive';
/** Only a quiesced, disposable harness database. Never imported by Worker code. */
export async function retireSyntheticCopies(
  h: Awaited<ReturnType<typeof harness>>,
  archive: EditorialR2Archive,
  now: number,
  approval: 'DISPOSABLE_SYNTHETIC_ONLY',
) {
  if (
    approval !== 'DISPOSABLE_SYNTHETIC_ONLY' ||
    !h.directory.includes('/dd-editorial-synthetic-') ||
    !h.options.d1Databases.EDITORIAL_DB.startsWith('editorial-synthetic-')
  )
    throw Error('Synthetic cleanup guard');
  const manifests = await h.db.query<any>(
    'synthetic.verify',
    "SELECT * FROM r2_archive_manifests WHERE state='ACTIVE' AND recovery_until<=?",
    [now],
    false,
  );
  for (const m of manifests) {
    await archive.unpack(m);
    const entries = await h.db.query<any>(
      'synthetic.directory',
      'SELECT * FROM r2_archive_records WHERE manifest_id=?',
      [m.id],
      false,
    );
    for (const entry of entries) await archive.resolve(JSON.parse(entry.pointer_json));
  }
  // No hot record, identity or directory is deleted. Only expired redundant copies.
  for (const m of manifests)
    await h.db.batch('synthetic.retire', [
      h.db.statement('UPDATE r2_archive_records SET original_json=NULL WHERE manifest_id=?', [
        m.id,
      ]),
    ]);
  const live = new Set<string>();
  const tables = (
    await h.binding
      .prepare(
        "SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE '_cf_%' AND name NOT LIKE 'sqlite_%'",
      )
      .all<{ name: string }>()
  ).results;
  for (const { name } of tables) {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) throw Error('Unexpected table identifier');
    const cols = (await h.binding.prepare(`PRAGMA table_info("${name}")`).all<any>()).results;
    for (const c of cols.filter((c) => c.type === 'TEXT')) {
      const rows = await h.db.query<any>(
        'synthetic.trace',
        `SELECT "${c.name}" value FROM "${name}" WHERE "${c.name}" LIKE '{"$storage":"dd-editorial-payload-v1"%'`,
        [],
        false,
      );
      for (const r of rows) for (const k of await archive.payloads.references(r.value)) live.add(k);
    }
  }
  let removed = 0;
  const blobs = await h.db.query<{ hash: string }>(
    'synthetic.blobs',
    'SELECT hash FROM editorial_blobs',
    [],
    false,
  );
  for (const { hash } of blobs)
    if (!live.has(hash)) {
      await h.db.batch('synthetic.unreferenced', [
        h.db.statement('DELETE FROM editorial_blob_fragments WHERE hash=?', [hash]),
        h.db.statement('DELETE FROM editorial_blobs WHERE hash=?', [hash]),
      ]);
      removed++;
    }
  return { verifiedManifests: manifests.length, removedUnreferencedBlobs: removed };
}
