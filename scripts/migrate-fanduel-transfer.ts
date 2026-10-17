import { loadEnvConfig } from '@next/env';
import postgres from 'postgres';
import { readFile } from 'node:fs/promises';
loadEnvConfig(process.cwd());
async function main() {
  const url = process.env.DATABASE_URL!;
  if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname))
    throw Error('This development migration requires a local database.');
  const db = postgres(url, { max: 1 });
  try {
    await db.unsafe(await readFile('db/migrations/051_fanduel_transfer_jobs.sql', 'utf8'));
    await db.unsafe(await readFile('db/migrations/052_sportsbook_transfer_jobs.sql', 'utf8'));
    console.log('Local transfer bookkeeping migration applied; no odds tables changed.');
  } finally {
    await db.end();
  }
}
main().catch(() => {
  console.error('Local transfer migration failed.');
  process.exitCode = 1;
});
