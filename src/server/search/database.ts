import postgres from 'postgres';
import { applicationBackend } from '../persistence/bindings';

let client: ReturnType<typeof postgres> | undefined;

export function searchDb() {
  if (applicationBackend() === 'd1')
    throw Error('PostgreSQL search is disabled in D1 mode; use the staged FTS adapter');
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is not configured');
  client ??= postgres(databaseUrl, {
    max: 5,
    idle_timeout: 20,
    ssl: databaseUrl.includes('localhost') ? false : 'require',
  });
  return client;
}
