import { writeFile } from 'node:fs/promises';
import { harness } from '../test/harness';
const h = await harness();
try {
  const plans = [];
  for (const [name, sql, args] of [
    [
      'receipt-id-and-dedupe',
      'SELECT id,object_hash FROM lean_receipts WHERE strategy=? AND kind=? AND id=? UNION ALL SELECT id,object_hash FROM lean_receipts WHERE strategy=? AND kind=? AND dedupe_key=?',
      ['A', 'job', 'job-1', 'A', 'job', 'once-1'],
    ],
    [
      'team-identity-update',
      'DELETE FROM lean_teams WHERE strategy=? AND kind=? AND id=?',
      ['A', 'story', 'story-1'],
    ],
    [
      'feed-seek',
      'SELECT h.* FROM lean_teams t JOIN lean_heads h ON h.strategy=t.strategy AND h.kind=t.kind AND h.id=t.id WHERE t.strategy=? AND t.team_id=? AND t.kind=? AND (t.published_at,t.id)<(?,?) ORDER BY t.published_at DESC,t.id DESC LIMIT ?',
      ['A', 'kc', 'story', 1800000000000, 'saved', 21],
    ],
    [
      'hot-retirement',
      'SELECT * FROM lean_versions WHERE strategy=? AND published_at<? AND inline_json IS NOT NULL ORDER BY published_at,kind,id,revision LIMIT ?',
      ['B', 1800000000000, 8],
    ],
  ] as const) {
    const plan = (
      await h.binding
        .prepare('EXPLAIN QUERY PLAN ' + sql)
        .bind(...args)
        .all()
    ).results as { detail: string }[];
    if (plan.some((row) => /SCAN (lean_receipts|lean_teams|t\b)/.test(row.detail)))
      throw Error('Unbounded critical lookup');
    plans.push({ name, sql, plan });
  }
  await writeFile('measurements/zero-cost-query-plans.json', JSON.stringify(plans, null, 2) + '\n');
} finally {
  await h.close();
}
