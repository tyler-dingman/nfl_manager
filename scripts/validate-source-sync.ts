/** Runs only against the disposable Unix-socket PostgreSQL created by the launcher. */
import assert from 'node:assert/strict';
import postgres from 'postgres';
import { databaseContext } from '../src/server/auth/database-context';
import { syncMonitoringRegistry } from '../src/server/monitoring/observer';
import { readFileSync, writeFileSync } from 'node:fs';

const socket = process.env.SOURCE_TEST_PG_SOCKET ?? '';
assert.match(socket, /^\/private\/tmp\/dd-source-pg-[A-Za-z0-9_-]+$/);
const db = postgres({
  host: socket,
  port: 6546,
  database: 'postgres',
  username: 'source_test',
  ssl: false,
  max: 1,
});
const captured: Array<{ text: string; values: any[] }> = [];
const fake = Object.assign(
  (strings: TemplateStringsArray, ...values: any[]) => {
    captured.push({
      text: strings.reduce((text, part, index) => text + (index ? `$${index}` : '') + part, ''),
      values,
    });
    return Promise.resolve([]);
  },
  { json: (value: unknown) => JSON.stringify(value) },
);
async function main() {
  try {
    const ddl = readFileSync('db/migrations/012_source_watcher_story_engine.sql', 'utf8');
    await db.unsafe(
      ddl.slice(
        ddl.indexOf('CREATE TABLE IF NOT EXISTS content_sources'),
        ddl.indexOf('CREATE TABLE IF NOT EXISTS ingestion_jobs'),
      ),
    );
    await databaseContext.run(fake as any, () => syncMonitoringRegistry('BUF'));
    assert.equal(captured.length, 8);
    for (const query of captured)
      assert.equal((await db.unsafe(query.text, query.values)).count, 1);
    for (const query of captured)
      assert.equal((await db.unsafe(query.text, query.values)).count, 0);
    const changed = { ...captured[0], values: [...captured[0].values] };
    changed.values[1] += ' updated';
    assert.equal((await db.unsafe(changed.text, changed.values)).count, 1);
    const rows = await db`SELECT count(*)::int AS count FROM content_sources`;
    assert.equal(rows[0].count, 8);
    writeFileSync(
      'reports/source-expansion/postgres-validation.json',
      JSON.stringify(
        {
          passed: true,
          scope:
            'Disposable Unix-socket-only PostgreSQL. Actual captured monitoring upserts; original migration table/index.',
          initialInserted: 8,
          identicalUpdates: 0,
          changedUpdates: 1,
          productionAccess: false,
          d1WritesMeasured: false,
        },
        null,
        2,
      ) + '\n',
    );
  } finally {
    await db.end();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
