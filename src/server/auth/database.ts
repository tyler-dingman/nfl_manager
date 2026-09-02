import postgres from 'postgres';
import { requireAuthConfig } from './config';

let client: ReturnType<typeof postgres> | undefined;

export function authDb() {
  if (!client) {
    const { DATABASE_URL } = requireAuthConfig();
    client = postgres(DATABASE_URL, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
      ssl: DATABASE_URL.includes('localhost') ? false : 'require',
    });
  }
  return client;
}
