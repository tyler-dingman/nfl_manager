import { loadEnvConfig } from '@next/env';
import { readFile } from 'node:fs/promises';
import postgres from 'postgres';
loadEnvConfig(process.cwd());
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw Error('DATABASE_URL required');
  if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname))
    throw Error(
      'This development setup script only applies to a local database. Use the reviewed deployment migration process for production.',
    );
  const sql = postgres(url, { max: 1, ssl: false });
  try {
    await sql.begin(async (tx) => {
      await tx.unsafe(await readFile('db/migrations/048_huddle.sql', 'utf8'));
    });
    console.log('Applied local Huddle schema.');
  } finally {
    await sql.end();
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
