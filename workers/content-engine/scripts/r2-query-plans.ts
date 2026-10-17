import { writeFile } from 'node:fs/promises';
import { harness } from '../test/harness';
const h = await harness();
try {
  const plans = [];
  for (const [name, sql, args] of [
    [
      'revision-cas',
      'UPDATE content_candidate_revisions SET record_json=? WHERE candidate_id=? AND revision=? AND record_json=?',
      ['{}', 'synthetic', 1, '{}'],
    ],
    [
      'operational-cas',
      'UPDATE archive_chunks SET payload_json=? WHERE chunk_id=? AND payload_json=?',
      ['[]', '1', '[]'],
    ],
    [
      'archive-directory',
      'SELECT * FROM r2_archive_records WHERE kind=? AND record_id=? AND revision=? AND manifest_id=?',
      ['revision', 'synthetic', 1, 'synthetic'],
    ],
  ] as const) {
    const result = await h.binding
      .prepare('EXPLAIN QUERY PLAN ' + sql)
      .bind(...args)
      .all<{ detail: string }>();
    if (!result.results.some((r) => r.detail.includes('SEARCH')))
      throw Error('Expected indexed lookup');
    plans.push({ name, plan: result.results });
  }
  await writeFile('measurements/r2-query-plans.json', JSON.stringify(plans, null, 2) + '\n');
  console.log('Three indexed key probes verified on local D1');
} finally {
  await h.close();
}
