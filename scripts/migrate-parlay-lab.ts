import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { loadEnvConfig } from '@next/env';
import postgres from 'postgres';

const MIGRATIONS = [
  '035_parlay_lab_odds.sql',
  '036_nflverse_historical_stats.sql',
  '037_historical_team_season_strength.sql',
  '038_expand_parlay_lab_sportsbooks.sql',
  '039_parlay_lab_research_first.sql',
  '040_fix_passing_rushing_yards.sql',
] as const;

async function main() {
  loadEnvConfig(process.cwd());
  const args = new Set(process.argv.slice(2));
  const production = args.has('--database=production');
  if (production && !args.has('--confirm-production')) {
    throw new Error(
      'Production migration refused. Re-run with --database=production --confirm-production after reviewing the audit.',
    );
  }
  const databaseUrl = production ? process.env.PRODUCTION_DATABASE_URL : process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(`${production ? 'PRODUCTION_DATABASE_URL' : 'DATABASE_URL'} is required`);
  }
  console.log(`Environment: ${production ? 'production' : 'local'}`);
  console.log(`Applying ${MIGRATIONS.length} scoped, idempotent Parlay Lab migrations.`);
  const sql = postgres(databaseUrl, {
    max: 1,
    ssl: databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1') ? false : 'require',
  });
  try {
    for (const file of MIGRATIONS) {
      const migration = await readFile(path.join(process.cwd(), 'db/migrations', file), 'utf8');
      await sql.unsafe(migration);
      console.log(`Applied ${file}`);
    }
  } finally {
    await sql.end();
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
