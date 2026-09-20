import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { loadEnvConfig } from '@next/env';
import postgres from 'postgres';
import { assertDailyThreeAndOutSchema } from '../src/server/three-and-out/schema';

async function main() {
  loadEnvConfig(process.cwd());
  const args = new Set(process.argv.slice(2));
  const production = args.has('--database=production');
  const checkOnly = args.has('--check');
  if (production && !checkOnly && !args.has('--confirm-production')) {
    throw new Error('Use --confirm-production to apply the reviewed migration to production.');
  }
  const key = production ? 'PRODUCTION_DATABASE_URL' : 'DATABASE_URL';
  const databaseUrl = process.env[key];
  if (!databaseUrl) throw new Error(`${key} is required`);
  const hostname = new URL(databaseUrl).hostname;
  const sql = postgres(databaseUrl, {
    max: 1,
    connect_timeout: 10,
    ssl: ['localhost', '127.0.0.1', '[::1]'].includes(hostname) ? false : 'require',
  });
  try {
    console.log(`Three & Out schema: ${production ? 'production' : 'configured DATABASE_URL'}`);
    if (!checkOnly) {
      await sql`SET lock_timeout = '10s'`;
      await sql`SET statement_timeout = '60s'`;
      await sql.unsafe(
        await readFile(
          path.join(process.cwd(), 'db/migrations/033_three_and_out_daily.sql'),
          'utf8',
        ),
      );
      console.log('Applied 033_three_and_out_daily.sql (additive; legacy snapshots retained).');
    }
    await assertDailyThreeAndOutSchema(sql);
    console.log('Three & Out schema ready.');
  } finally {
    await sql.end();
  }
}
void main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Schema update failed');
  process.exitCode = 1;
});
