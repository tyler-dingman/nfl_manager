import { readFile, writeFile, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { harness } from '../test/harness';
import { Storage, type SqlDatabase } from '../../../packages/storage/core';
import { PrivateObjects, type Bucket } from '../../../packages/storage/objects';
import { importPostgres, type PostgresExport } from '../../../packages/storage/import';
import { D1AuthRepository } from '../../../packages/storage/auth';
import { D1UserRepository } from '../../../packages/storage/user';
const path = process.argv[2];
if (!path?.startsWith('/private/tmp/dd-phase-three-pg-'))
  throw Error('Only this runner’s disposable synthetic export is accepted');
const source = JSON.parse(await readFile(path, 'utf8')) as PostgresExport,
  h = await harness(true);
try {
  const objects = new PrivateObjects(
      (await h.mf.getR2Bucket('EDITORIAL_ARCHIVE')) as unknown as Bucket,
      (await h.mf.getR2Bucket('EDITORIAL_BACKUP')) as unknown as Bucket,
    ),
    s = new Storage(h.binding as unknown as SqlDatabase, objects),
    start = performance.now(),
    result = await importPostgres(s, source);
  for (const raw of source.tables.find((t) => t.name === 'users')!.rows) {
    const original = JSON.parse(raw),
      restored = await new D1AuthRepository(s).findUserById(original.id);
    assert.equal(restored?.id, original.id);
    assert.equal(restored?.primary_email, original.primary_email);
  }
  for (const raw of source.tables.find((t) => t.name === 'user_credentials')!.rows) {
    const original = JSON.parse(raw);
    assert.equal(
      (await new D1AuthRepository(s).getCredential(original.user_id))?.password_hash,
      original.password_hash,
    );
  }
  const restarted = await h.restart(),
    next = new Storage(
      restarted as unknown as SqlDatabase,
      new PrivateObjects((await h.mf.getR2Bucket('EDITORIAL_ARCHIVE')) as unknown as Bucket),
    );
  const user = JSON.parse(
    source.tables
      .find((t) => t.name === 'users')!
      .rows.find((r) => JSON.parse(r).primary_email === 'synthetic@example.invalid')!,
  );
  assert.equal(
    (await new D1UserRepository(next).getProfile(user.id))?.primaryEmail,
    'synthetic@example.invalid',
  );
  const retained = await next.rows('SELECT * FROM app_imports WHERE source_table=?', [
    'user_front_office_saves',
  ]);
  assert(retained.length >= 1);
  // Import is intentionally not resumed into a partial target. Source is intact;
  // restart with a fresh binding, preserving the failed target for diagnosis.
  await assert.rejects(importPostgres(next, source));
  const files = await readdir(h.directory, { recursive: true }),
    file = files.find((f) => f.includes('d1') && f.endsWith('.sqlite') && !f.includes('metadata'));
  if (!file) throw Error('Synthetic SQLite database not found');
  const pages = JSON.parse(
    execFileSync('python3', ['scripts/sqlite-pages.py', join(h.directory, file)], {
      encoding: 'utf8',
    }),
  );
  await writeFile(
    '../../reports/zero-cost-phase-3/postgres-d1-import.json',
    JSON.stringify(
      {
        ...result,
        milliseconds: performance.now() - start,
        sqlite: pages,
        r2Writes: objects.writes,
        r2WrittenBytes: objects.bytes,
        restartVerified: true,
        credentialsPreserved: true,
        sourceModified: false,
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify(result));
} finally {
  await h.close();
}
