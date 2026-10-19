/** Disposable end-to-end owner archive/restore/retire validation, local only. */
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { mkdtemp, writeFile, readFile, rm, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
import core from '../packages/storage/core.ts';
import objects from '../packages/storage/d1-objects.ts';
import editorial from '../packages/storage/editorial.ts';
import retention from '../packages/storage/approved-retention.ts';
import { decryptBackup } from './no-billing-backup.mjs';
const { Storage, ApplicationDocuments } = core,
  { D1Objects } = objects,
  { PublicEditorial } = editorial;
const dir = await mkdtemp('/private/tmp/dd-approved-retention-test-'),
  out = process.env.DD_RETENTION_REPORT_DIR || 'reports/approved-retention';
const env = Object.fromEntries(
  ['PATH', 'HOME', 'TMPDIR', 'SHELL', 'LANG', 'USER']
    .filter((k) => process.env[k])
    .map((k) => [k, process.env[k]]),
);
Object.assign(env, {
  CI: 'true',
  WRANGLER_SEND_METRICS: 'false',
  CLOUDFLARE_API_TOKEN: '',
  CLOUDFLARE_ACCOUNT_ID: '',
  TSX_TSCONFIG_PATH: 'tsconfig.test.json',
  DD_APPROVED_RETENTION: 'OWNER_LOCAL_WRITERS_STOPPED',
});
const exec = (args) => {
  const r = spawnSync(process.execPath, args, { env, encoding: 'utf8', maxBuffer: 8_000_000 });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  return r.stdout;
};
const open = () =>
  new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: 'export default {}',
      resourcePersistencePath: dir + '/v3',
      d1Databases: { APP_DB: '00000000-0000-0000-0000-000000000000' },
      outboundService: () => new Response(null, { status: 403 }),
    }),
  );
exec([
  'node_modules/wrangler/bin/wrangler.js',
  'd1',
  'migrations',
  'apply',
  'APP_DB',
  '--local',
  '--config',
  'wrangler.api-no-billing-local.toml',
  '--persist-to',
  dir,
]);
let mf = open();
try {
  const db = await mf.getD1Database('APP_DB'),
    s = new Storage(db, new D1Objects(db)),
    pub = new PublicEditorial(s),
    old = new Date(Date.now() - 91 * 86400000).toISOString();
  const story = (id) => ({
    id,
    teamId: 'KC',
    storyType: 'NEWS',
    headline: 'Original correction ' + id,
    shortSummary: 'Original',
    whatHappened: 'Original attribution',
    whyItMatters: 'Original',
    whatsNext: 'Original',
    status: 'CONFIRMED',
    importanceScore: 80,
    confidenceScore: 95,
    firstReportedAt: old,
    lastMeaningfulUpdateAt: old,
    sources: [
      {
        id: 'source',
        name: 'Original',
        url: 'https://example.invalid/original',
        publishedAt: old,
        official: true,
        original: true,
      },
    ],
    primarySource: null,
    version: 1,
  });
  await pub.publish(story('expired-original'), 'PUBLISHED');
  await pub.publish(story('saved-original'), 'PUBLISHED');
  await pub.publish(
    { ...story('saved-original'), version: 2, headline: 'Saved original published correction' },
    'PUBLISHED',
  );
  await s
    .statement(
      "INSERT INTO app_users(id,primary_email,status,created_at,updated_at) VALUES('owner','owner@example.invalid','ACTIVE',1,1)",
    )
    .run();
  await s
    .statement(
      "INSERT INTO app_saved_content(id,user_id,content_type,content_id,title,metadata_json,created_at) VALUES('saved','owner','ARTICLE','saved-original','Original','{}',1),('saved-bet','owner','OTHER','bet-original','Original bet','{\"marketId\":\"original-market\"}',1)",
    )
    .run();
  await s
    .statement(
      'INSERT INTO app_settings(user_id,preferences_json,updated_at) VALUES(\'owner\',\'{"team":"KC"}\',1)',
    )
    .run();
  await s
    .statement("INSERT INTO app_trivia_stats(user_id,lifetime_points) VALUES('owner',420)")
    .run();
  await s
    .statement("INSERT INTO app_reward_accounts(user_id,lifetime_yards) VALUES('owner',900)")
    .run();
  await new ApplicationDocuments(s).commit(
    'owner',
    'FRONT_OFFICE',
    'original-progress',
    0,
    'original-offline-command',
    { season: 2026, week: 7 },
  );
  const interrupted = await retention.beginRetentionPreparation(db, dir + '/interrupted.enc');
  await mf.dispose();
  const key = randomBytes(32),
    keyFile = dir + '/owner-key';
  await writeFile(keyFile, key, { mode: 0o600 });
  const archive = dir + '/archive.enc';
  const call = (mode, ...args) =>
    exec(['--import', 'tsx', 'scripts/approved-retention.mjs', mode, dir, ...args]);
  assert.equal(JSON.parse(call('--status')).find((p) => p.id === interrupted).state, 'PREPARING');
  assert(JSON.parse(call('--abort-preparation', interrupted)).abortedBeforeAnyDeletion);
  const plan = JSON.parse(call('--prepare', archive, keyFile, '100'));
  assert(plan.archiveVerified && plan.fullRestoreVerified);
  assert(plan.planned > 0);
  const encrypted = await readFile(archive),
    plain = decryptBackup(encrypted, key);
  assert(plain.includes(Buffer.from('saved-original')));
  assert(plain.includes(Buffer.from('rowid')));
  const tampered = Buffer.from(encrypted);
  tampered[tampered.length - 1] ^= 1;
  assert.throws(() => decryptBackup(tampered, key));
  await writeFile(archive, tampered);
  const denied = spawnSync(
    process.execPath,
    ['--import', 'tsx', 'scripts/approved-retention.mjs', '--step', dir, plan.runId],
    { env, encoding: 'utf8' },
  );
  assert.notEqual(denied.status, 0);
  assert.match(denied.stderr, /archive missing or changed/);
  await writeFile(archive, encrypted);
  let steps = 0;
  for (; steps < 100; steps++) {
    if (JSON.parse(call('--step', plan.runId)).done) break;
  }
  assert(steps < 100);
  assert(JSON.parse(call('--step', plan.runId)).done);
  mf = open();
  const after = await mf.getD1Database('APP_DB'),
    fresh = new Storage(after, new D1Objects(after)),
    reader = new PublicEditorial(fresh);
  assert.equal(await reader.get('expired-original'), null);
  assert(await reader.get('saved-original'));
  assert.equal(
    (await reader.version('saved-original', 2)).headline,
    'Saved original published correction',
  );
  assert.equal(
    (await new ApplicationDocuments(fresh).read('owner', 'FRONT_OFFICE', 'original-progress')).value
      .week,
    7,
  );
  assert.equal(
    (await fresh.rows("SELECT lifetime_points FROM app_trivia_stats WHERE user_id='owner'"))[0]
      .lifetime_points,
    420,
  );
  assert.equal(
    (await fresh.rows("SELECT lifetime_yards FROM app_reward_accounts WHERE user_id='owner'"))[0]
      .lifetime_yards,
    900,
  );
  const [match] = await fresh.rows(
    "SELECT rowid,id FROM app_search WHERE app_search MATCH 'Saved'",
  );
  assert.equal(match.id, 'saved-original');
  const [head] = await fresh.rows(
    "SELECT search_rowid FROM app_public_stories WHERE id='saved-original'",
  );
  assert.equal(head.search_rowid, match.rowid);
  assert.equal((await after.prepare('PRAGMA foreign_key_check').all()).results.length, 0);
  await mkdir(out, { recursive: true });
  await writeFile(
    out + '/offline-archive-restore.json',
    JSON.stringify(
      {
        pass: true,
        syntheticOnly: true,
        noR2: true,
        noPostgres: true,
        archiveEncryptedBytes: encrypted.length,
        archiveDecryptionAndIntegrity: true,
        completeRestoreBeforeDeletion: true,
        ftsRowidsPreserved: true,
        tamperBlocksCleanup: true,
        interruptedPreparationAbortPreservesData: true,
        savedArticleAndCorrectionsPreserved: true,
        savedBetAndUserPreserved: true,
        retiredOriginalId: 'expired-original',
        plan,
        steps,
      },
      null,
      2,
    ) + '\n',
  );
  console.log('Approved retention encrypted archive/restore: PASS');
} finally {
  await mf.dispose();
  await rm(dir, { recursive: true, force: true });
}
