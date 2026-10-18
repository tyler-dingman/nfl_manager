import { databaseContext } from './database-context';
import postgres from 'postgres';
import { applicationBackend } from '../persistence/bindings';
import { requireAuthConfig } from './config';

let client: ReturnType<typeof postgres> | undefined;

export function authDb() {
  if (applicationBackend() === 'd1')
    throw Error('PostgreSQL access forbidden in D1 mode: this code path still needs migration');
  const scoped = databaseContext.getStore();
  if (scoped) return scoped;
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

/** Join the request transaction instead of opening an independent gameplay commit. */
export function authTransaction<T>(
  operation: (db: ReturnType<typeof authDb>) => Promise<T>,
): Promise<T> {
  const scoped = databaseContext.getStore();
  return scoped
    ? operation(scoped)
    : (authDb().begin((tx) => operation(tx as unknown as ReturnType<typeof authDb>)) as Promise<T>);
}
