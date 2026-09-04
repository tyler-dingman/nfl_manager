import postgres from 'postgres';

let client: ReturnType<typeof postgres> | undefined;

export function searchDb() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is not configured');
  client ??= postgres(databaseUrl, {
    max: 5,
    idle_timeout: 20,
    ssl: databaseUrl.includes('localhost') ? false : 'require',
  });
  return client;
}
