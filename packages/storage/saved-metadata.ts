import { Storage } from './core';
/** Lossless pointer publication only. Existing IDs and saved rows are retained. */
export async function offloadSavedMetadata(s: Storage, limit = 3) {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 3)
    throw Error('Saved metadata batch limit');
  const rows = await s.rows<any>(
    'SELECT id,user_id,content_type,content_id,metadata_json FROM app_saved_content WHERE metadata_hash IS NULL AND length(CAST(metadata_json AS BLOB))>512 ORDER BY id LIMIT ?',
    [limit],
  );
  let moved = 0;
  for (const row of rows) {
    const hash = await s.put({
      schema: 1,
      owner: row.user_id,
      contentType: row.content_type,
      contentId: row.content_id,
      metadata: JSON.parse(row.metadata_json),
    });
    const updated = await s
      .statement(
        "UPDATE app_saved_content SET metadata_json='{}',metadata_hash=? WHERE id=? AND user_id=? AND metadata_hash IS NULL AND metadata_json=?",
        [hash, row.id, row.user_id, row.metadata_json],
      )
      .run();
    moved += updated.meta.changes ?? 0;
  }
  return { moved };
}
