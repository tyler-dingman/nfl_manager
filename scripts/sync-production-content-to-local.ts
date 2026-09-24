import { loadEnvConfig } from '@next/env';
import postgres from 'postgres';

// Deliberately exclude users, user state, jobs, notification outboxes, and automation history.
const tables = [
  'content_sources',
  'content_candidates',
  'canonical_stories',
  'story_evidence',
  'story_versions',
  'story_editorial_overrides',
  'story_publication_decisions',
  'three_and_out_snapshots',
];

async function main() {
  loadEnvConfig(process.cwd());
  if (!process.argv.includes('--confirm-content-replacement')) {
    throw new Error('Back up local first, then pass --confirm-content-replacement.');
  }
  const localUrl = process.env.DATABASE_URL;
  const productionUrl = process.env.PRODUCTION_DATABASE_URL;
  if (!localUrl || !productionUrl) throw new Error('Both database URLs are required.');
  if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(localUrl).hostname)) {
    throw new Error('Destination must be localhost.');
  }
  if (localUrl === productionUrl) throw new Error('Source and destination must differ.');
  const local = postgres(localUrl, { max: 1, ssl: false });
  const production = postgres(productionUrl, { max: 1, ssl: 'require' });
  try {
    const snapshot: Record<string, Record<string, unknown>[]> = {};
    await production.begin('isolation level repeatable read read only', async (sql) => {
      for (const table of tables) {
        const rows = await sql<
          { row_data: Record<string, unknown> }[]
        >`SELECT to_jsonb(t) AS row_data FROM ${sql(table)} t`;
        snapshot[table] = rows.map((row) => row.row_data);
        console.log(`Read ${table}: ${snapshot[table].length}`);
      }
    });
    await local.begin(async (sql) => {
      // Local queued jobs refer to the replaced candidates; never import production jobs.
      await sql`DELETE FROM ingestion_jobs WHERE job_type IN ('SOURCE_FETCH','CANDIDATE_PROCESS')`;
      // Dependent evidence, versions, editorial decisions and observer rows cascade with content.
      await sql`DELETE FROM canonical_stories`;
      await sql`DELETE FROM content_candidates`;
      await sql`DELETE FROM three_and_out_snapshots`;
      for (const table of tables) {
        const columns = await sql<{ column_name: string }[]>`
          SELECT column_name FROM information_schema.columns
          WHERE table_schema='public' AND table_name=${table} ORDER BY ordinal_position`;
        const names = columns.map((column) => column.column_name);
        if (snapshot[table].some((row) => Object.keys(row).some((key) => !names.includes(key)))) {
          throw new Error(`Local schema is missing production columns for ${table}`);
        }
        // Sources may also be referenced by local diagnostic rows; preserve their IDs via upsert.
        const updates = names
          .filter((name) => name !== 'id')
          .map((name) => `"${name}"=EXCLUDED."${name}"`)
          .join(',');
        for (let start = 0; start < snapshot[table].length; start += 250) {
          const rows = snapshot[table].slice(start, start + 250);
          await sql.unsafe(
            `INSERT INTO "${table}" SELECT * FROM json_populate_recordset(NULL::"${table}", $1::text::json)` +
              (table === 'content_sources' ? ` ON CONFLICT(id) DO UPDATE SET ${updates}` : ''),
            [JSON.stringify(rows)],
          );
        }
        const [count] = await sql`SELECT count(*)::int AS count FROM ${sql(table)}`;
        if (table !== 'content_sources' && count.count !== snapshot[table].length) {
          throw new Error(`Verification failed for ${table}`);
        }
        console.log(`Verified ${table}: ${snapshot[table].length} production rows`);
      }
    });
    console.log('Content sync committed. Production was read-only.');
  } finally {
    await Promise.all([local.end(), production.end()]);
  }
}
void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
