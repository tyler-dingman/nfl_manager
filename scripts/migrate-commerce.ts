import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { loadEnvConfig } from '@next/env';
import postgres from 'postgres';

// Commerce-only repair/setup; avoids replaying unrelated auth/search/content migrations.
async function main() {
  loadEnvConfig(process.cwd());
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  const host = new URL(databaseUrl).hostname;
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(host);
  const sql = postgres(databaseUrl, { max: 1, ssl: local ? false : 'require' });
  try {
    const [schema] = await sql`SELECT to_regclass('users') AS users`;
    if (!schema.users) throw new Error('Apply the auth migrations before setting up commerce.');
    for (const file of [
      '023_commerce.sql',
      '024_stripe_webhooks.sql',
      '025_stripe_checkout_attempts.sql',
      '026_commerce_payment_hardening.sql',
    ]) {
      await sql.unsafe(await readFile(path.join(process.cwd(), 'db/migrations', file), 'utf8'));
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
