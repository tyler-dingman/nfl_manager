/** Never log database errors wholesale: connection strings and SQL values may be attached. */
export function scheduleFailure(error: unknown) {
  const code = (error as { code?: unknown } | null)?.code;
  const databaseCode =
    typeof code === 'string' && /^[A-Z0-9_]{2,32}$/.test(code) ? code : undefined;
  const missingConfiguration = ['DATABASE_URL', 'AUTH_JWT_SECRET'].filter(
    (key) => !process.env[key],
  );
  return {
    category: missingConfiguration.length
      ? 'missing-configuration'
      : databaseCode === '42703' || databaseCode === '42P01'
        ? 'missing-schema'
        : 'data-source-failure',
    databaseCode,
    missingConfiguration,
    ...(databaseCode === '42703' || databaseCode === '42P01'
      ? { migration: 'db/migrations/042_canonical_schedule.sql' }
      : {}),
  };
}
