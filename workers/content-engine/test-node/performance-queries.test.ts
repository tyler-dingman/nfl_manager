import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { harness } from '../test/harness';
test(
  'indexed upcoming-event range preserves rows while avoiding historical board scan',
  { timeout: 60000 },
  async () => {
    const h = await harness();
    try {
      await h.binding
        .prepare(
          "WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i+1 FROM n WHERE i<10000) INSERT INTO app_sportsbook_events(id,provider_event_id,season,week,home_team_id,away_team_id,kickoff_at,status,last_imported_at,as_of) SELECT printf('original-%05d',i),printf('provider-%05d',i),2026,1,'KC','SEA',i,'SCHEDULED',1,1 FROM n",
        )
        .run();
      const beforeSql =
          'SELECT * FROM app_sportsbook_events WHERE ?=1 OR kickoff_at>? ORDER BY kickoff_at,id',
        afterSql = 'SELECT * FROM app_sportsbook_events WHERE kickoff_at>? ORDER BY kickoff_at,id';
      const before = await h.binding.prepare(beforeSql).bind(0, 9984).all(),
        after = await h.binding.prepare(afterSql).bind(9984).all();
      assert.deepEqual(after.results, before.results);
      assert.equal(after.results.length, 16);
      assert(Number(after.meta.rows_read) < Number(before.meta.rows_read) / 10);
      const plans = {
        before: (
          await h.binding
            .prepare('EXPLAIN QUERY PLAN ' + beforeSql)
            .bind(0, 9984)
            .all()
        ).results,
        after: (
          await h.binding
            .prepare('EXPLAIN QUERY PLAN ' + afterSql)
            .bind(9984)
            .all()
        ).results,
      };
      await writeFile(
        '../../reports/performance/query-plans.json',
        JSON.stringify(
          {
            scope: 'actual local Miniflare D1, 10000 events, 16 upcoming; no new index',
            before: before.meta,
            after: after.meta,
            plans,
            extraIndexBytes: 0,
            extraWrites: 0,
          },
          null,
          2,
        ) + '\n',
      );
    } finally {
      await h.close();
    }
  },
);
