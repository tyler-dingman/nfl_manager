/** Synthetic CLI integration. Never opens an existing database or remote resource. */
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import core from '../packages/storage/core.ts';
const { Storage, objectKey } = core;
import payloads from '../packages/storage/d1-objects.ts';
const { D1Objects } = payloads;
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
const directory = await mkdtemp('/private/tmp/dd-storage-cli-synthetic-');
const open = () =>
  new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: 'export default {}',
      resourcePersistencePath: directory + '/v3',
      d1Databases: { APP_DB: '00000000-0000-0000-0000-000000000000' },
      outboundService: () => new Response(null, { status: 403 }),
    }),
  );
const env = Object.fromEntries(
  ['PATH', 'HOME', 'TMPDIR', 'SHELL', 'LANG', 'USER']
    .filter((k) => process.env[k])
    .map((k) => [k, process.env[k]]),
);
Object.assign(env, {
  DD_STORAGE_MAINTENANCE: 'RAW_WRITERS_STOPPED',
  CI: 'true',
  WRANGLER_SEND_METRICS: 'false',
  CLOUDFLARE_API_TOKEN: '',
  CLOUDFLARE_ACCOUNT_ID: '',
});
const migration = spawnSync(
  process.execPath,
  [
    'node_modules/wrangler/bin/wrangler.js',
    'd1',
    'migrations',
    'apply',
    'APP_DB',
    '--local',
    '--config',
    'wrangler.api-no-billing-local.toml',
    '--persist-to',
    directory,
  ],
  { env, encoding: 'utf8', maxBuffer: 4_000_000 },
);
assert.equal(migration.status, 0, migration.stdout + migration.stderr);
let mf = open();
try {
  const db = await mf.getD1Database('APP_DB');
  const s = new Storage(db, new D1Objects(db));
  await s
    .statement(
      "INSERT INTO app_users(id,primary_email,status,created_at,updated_at) VALUES('owner','owner@example.invalid','ACTIVE',1,1)",
    )
    .run();
  const child = await s.put({ original: 'permanent-child' }),
    root = await s.put({ root: child }),
    orphan = await s.put({ orphan: 'temporary failed upload' });
  await s
    .statement(
      "INSERT INTO app_saved_content(id,user_id,content_type,content_id,title,metadata_json,metadata_hash,created_at) VALUES('original-save','owner','OTHER','original-bet','Original','{}',?,1)",
      [root],
    )
    .run();
  await mf.dispose();
  const call = (mode, count = '5') => {
    const r = spawnSync(
      process.execPath,
      ['--import', 'tsx', 'scripts/collect-sustainable-storage.mjs', directory, mode, count],
      { env, encoding: 'utf8', maxBuffer: 4_000_000 },
    );
    assert.equal(r.status, 0, r.stdout + r.stderr);
    return JSON.parse(r.stdout);
  };
  const preview = call('--dry-run');
  assert.equal(preview.result.candidateObjects, 1);
  assert.equal(preview.result.deletedObjects, 0);
  const prepared = call('--prepare');
  const applied = call('--step', prepared.result.runId);
  assert.equal(applied.result.deleted, 1);
  const finished = call('--step', prepared.result.runId);
  assert.equal(finished.result.done, true);
  const idempotent = call('--step', prepared.result.runId);
  assert.equal(idempotent.result.deleted, 0);
  const repeated = call('--apply');
  assert.equal(repeated.result.deletedObjects, 0);
  mf = open();
  const restored = await mf.getD1Database('APP_DB'),
    objects = new D1Objects(restored);
  assert(await objects.get(objectKey(root)));
  assert(await objects.get(objectKey(child)));
  assert.equal(await objects.get(objectKey(orphan)), null);
  assert.equal(
    (await restored.prepare('SELECT id FROM app_saved_content').first()).id,
    'original-save',
  );
  const report = {
    pass: true,
    syntheticOnly: true,
    r2: false,
    postgres: false,
    preview,
    prepared,
    applied,
    finished,
    idempotent,
    repeated,
    requiredRootAndChildPreserved: true,
    originalSavedIdPreserved: true,
  };
  await writeFile(
    (process.env.DD_STORAGE_REPORT_DIR || 'reports/sustainable-storage') +
      '/owner-maintenance-cli.json',
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log('Owner maintenance CLI: PASS');
} finally {
  await mf.dispose();
  await rm(directory, { recursive: true, force: true });
}
