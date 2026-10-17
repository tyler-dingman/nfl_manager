import { writeFile } from 'node:fs/promises';
import { harness } from '../test/harness';
const h = await harness();
try {
  const plans = [];
  for (const [name, sql, args] of [
    [
      'blob-location',
      'SELECT p.pack_hash,b.byte_offset,b.encoded_length FROM editorial_blobs b JOIN editorial_blob_packs p ON p.id=b.pack_id WHERE b.hash=?',
      ['synthetic'],
    ],
    [
      'pack-selection',
      'SELECT b.* FROM editorial_blobs b WHERE b.pack_id IS NULL ORDER BY b.hash LIMIT ?',
      [32],
    ],
    [
      'source-history',
      'SELECT r.candidate_id,r.revision FROM content_candidates c JOIN content_candidate_revisions r ON r.candidate_id=c.id WHERE c.source_id=? AND r.observed_at>=?',
      ['source-1', 0],
    ],
  ] as const)
    plans.push({
      name,
      sql,
      plan: (
        await h.binding
          .prepare('EXPLAIN QUERY PLAN ' + sql)
          .bind(...args)
          .all()
      ).results,
    });
  await writeFile(
    'measurements/storage-final-query-plans.json',
    JSON.stringify(plans, null, 2) + '\n',
  );
} finally {
  await h.close();
}
