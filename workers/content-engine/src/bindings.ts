export interface Env {
  EDITORIAL_DB: D1Database;
  CONTENT_ENV: 'local';
  CONTENT_NETWORK_ENABLED: 'false';
}
export function validateBindings(input: unknown): Env {
  const env = input as Partial<Env> | null;
  if (
    !env ||
    env.CONTENT_ENV !== 'local' ||
    env.CONTENT_NETWORK_ENABLED !== 'false' ||
    !env.EDITORIAL_DB ||
    typeof env.EDITORIAL_DB.prepare !== 'function' ||
    typeof env.EDITORIAL_DB.batch !== 'function'
  )
    throw new Error('Local-only editorial bindings are missing or unsafe.');
  return env as Env;
}
