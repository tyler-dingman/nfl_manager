import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';

/** Only disposable FO test schemas; never export an existing application schema. */
export async function verifyGameCheckpoint(
  db: ReturnType<typeof postgres>,
  admin: ReturnType<typeof postgres>,
  schema: string,
) {
  if (process.env.PHASE_TWO_SYNTHETIC_DATABASE !== 'true' || !/^fo_test_[a-f0-9]+$/.test(schema))
    throw Error('Synthetic checkpoint scope required');
  const url = new URL(process.env.DATABASE_URL!);
  if (!['localhost', '127.0.0.1'].includes(url.hostname)) throw Error('Localhost only');
  const folder = await mkdtemp('/private/tmp/dd-phase-two-game-');
  const database = `phase_two_game_${randomUUID().replaceAll('-', '')}`;
  let restored: ReturnType<typeof postgres> | undefined,
    created = false;
  const execute = promisify(execFile);
  try {
    const names = (
      await db<
        { tablename: string }[]
      >`SELECT tablename FROM pg_tables WHERE schemaname=${schema} ORDER BY tablename`
    ).map((r) => r.tablename);
    async function fingerprints(connection: ReturnType<typeof postgres>) {
      const result: Record<string, unknown> = {};
      for (const name of names) {
        if (!/^[a-z0-9_]+$/.test(name)) throw Error('Invalid table identity');
        const [row] = await connection.unsafe(
          `SELECT count(*)::int rows,md5(coalesce(string_agg(to_jsonb(t)::text,E'\n' ORDER BY to_jsonb(t)::text),'')) checksum FROM "${schema}"."${name}" t`,
        );
        result[name] = row;
      }
      return result;
    }
    const before = await fingerprints(db),
      start = performance.now();
    const file = `${folder}/checkpoint.sql`;
    await execute('pg_dump', [
      '--no-owner',
      '--no-acl',
      `--schema=${schema}`,
      `--file=${file}`,
      url.toString(),
    ]);
    const backupMs = performance.now() - start;
    await admin.unsafe(`CREATE DATABASE ${database}`);
    created = true;
    url.pathname = `/${database}`;
    const restoreStart = performance.now();
    await execute('psql', ['-X', '-q', '-v', 'ON_ERROR_STOP=1', url.toString(), '-f', file]);
    restored = postgres(url.toString(), { max: 1, ssl: false, onnotice: () => {} });
    const after = await fingerprints(restored);
    if (JSON.stringify(before) !== JSON.stringify(after))
      throw Error('Game checkpoint fingerprint mismatch');
    const metrics = {
      scope:
        'MEASURED synthetic complete FO test-schema dump/restore: owners, sessions, runtime state, shared references, recovery evidence and command receipts. Exclusive test run, not a cross-store production checkpoint.',
      tables: before,
      dumpBytes: (await stat(file)).size,
      backupMs,
      restoreAndVerifyMs: performance.now() - restoreStart,
    };
    await writeFile(
      'reports/zero-cost-phase-2/front-office-restore.json',
      JSON.stringify(metrics, null, 2) + '\n',
    );
    return metrics;
  } finally {
    await restored?.end();
    if (created) await admin.unsafe(`DROP DATABASE ${database}`);
    await rm(folder, { recursive: true, force: true });
  }
}
