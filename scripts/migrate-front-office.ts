import { loadEnvConfig } from '@next/env';
import { readFile } from 'node:fs/promises';
import postgres from 'postgres';

async function main() {
  loadEnvConfig(process.cwd());
  const value = process.env.DATABASE_URL;
  if (!value) throw new Error('DATABASE_URL is required.');
  const url = new URL(value);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
    throw new Error('This migration runner permits localhost only. Production is not authorized.');
  const sql = postgres(value, { max: 1, ssl: false });
  try {
    const fingerprint = async () =>
      sql`SELECT count(*)::int AS saves,md5(COALESCE(string_agg(to_jsonb(s)::text,'' ORDER BY user_id,save_id),'')) AS checksum FROM user_front_office_saves s`;
    const before = await fingerprint();
    await sql.unsafe(await readFile('db/migrations/053_front_office_durable_commands.sql', 'utf8'));
    const after = await fingerprint();
    if (JSON.stringify(before) !== JSON.stringify(after))
      throw new Error('Save inventory changed during migration; inspect before continuing.');
    console.log({ preservedSaves: before[0].saves, originalRecordsUnchanged: true });
    console.log(
      'Applied additive Front Office migration to localhost. Existing saves preserved as legacy records.',
    );
  } finally {
    await sql.end();
  }
}
void main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Migration failed');
  process.exitCode = 1;
});
