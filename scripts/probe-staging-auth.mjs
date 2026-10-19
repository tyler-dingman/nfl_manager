import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtemp, writeFile, readFile, rm, mkdir, symlink } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import assert from 'node:assert/strict';
import { hash, verify } from '@node-rs/argon2';
import { createDecipheriv, createHash } from 'node:crypto';
const directory = await mkdtemp('/private/tmp/dd-staging-auth-'),
  out = process.env.DD_AUTH_REPORT_DIR ?? 'reports/staging-readiness';
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
  NODE_OPTIONS: '--require ./scripts/phase-two-network-guard.cjs',
});
assert(!('DATABASE_URL' in env));
assert(!('PRODUCTION_DATABASE_URL' in env));
const cli = ['node_modules/wrangler/bin/wrangler.js'];
function execute(args) {
  const r = spawnSync(process.execPath, [...cli, ...args], {
    env,
    encoding: 'utf8',
    maxBuffer: 5000000,
  });
  if (r.status !== 0) throw Error(r.stdout + r.stderr);
  return r.stdout;
}
const common = [
  '--local',
  '--config',
  process.env.DD_NO_R2 === 'true'
    ? 'wrangler.api-no-billing-local.toml'
    : 'wrangler.api-local.toml',
  '--persist-to',
  directory,
];
execute(['d1', 'migrations', 'apply', 'APP_DB', ...common]);
const sql = (command) =>
  JSON.parse(execute(['d1', 'execute', 'APP_DB', ...common, '--command', command, '--json']))[0]
    .results;
const socket = createServer();
await new Promise((r) => socket.listen(0, '127.0.0.1', r));
const port = socket.address().port;
await new Promise((r) => socket.close(r));
const base = `http://localhost:${port}`,
  secret = 'synthetic-staging-mail-secret-at-least-32-characters';
const log = createWriteStream(out + '/password-worker.log');
let child;
async function start() {
  child = spawn(
    process.execPath,
    [
      ...cli,
      'dev',
      '--local',
      '--config',
      process.env.DD_NO_R2 === 'true'
        ? 'wrangler.api-no-billing-local.toml'
        : 'wrangler.api-local.toml',
      '--config',
      'workers/password/wrangler.toml',
      '--port',
      String(port),
      '--ip',
      '127.0.0.1',
      '--persist-to',
      directory,
      '--var',
      'APP_PASSWORD_ENABLED:true',
      '--var',
      `AUTH_JWT_SECRET:${secret}`,
      '--var',
      `APP_MAIL_ENCRYPTION_KEY:${secret}`,
      '--var',
      `AUTH_BASE_URL:${base}`,
      '--var',
      'PRELAUNCH_MODE:false',
    ],
    { env, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  child.stdout.pipe(log, { end: false });
  child.stderr.pipe(log, { end: false });
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(base + '/api/auth/config')).ok) return;
    } catch {}
    if (child.exitCode !== null) throw Error('Worker startup failed');
    await new Promise((r) => setTimeout(r, 200));
  }
  throw Error('Worker readiness timeout');
}
async function stop() {
  if (child && child.exitCode === null) {
    const p = new Promise((r) => child.once('exit', r));
    child.kill('SIGTERM');
    await p;
  }
}
const localSamples = [];
const call = async (path, body, cookie) => {
  const start = performance.now();
  const response = await fetch(base + '/api/auth/' + path, {
    method: body ? 'POST' : 'GET',
    headers: { 'content-type': 'application/json', origin: base, ...(cookie ? { cookie } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  localSamples.push({
    operation: path.split('?')[0],
    status: response.status,
    localTimeToHeadersMs: performance.now() - start,
    hostedCpuMs: null,
  });
  return response;
};
const cookie = (r) => r.headers.get('set-cookie').split(';')[0];
try {
  await start();
  const password = 'synthetic-password-🏈-long';
  assert.equal((await (await call('config')).json()).email, true);
  const signup = await call('signup', { email: 'wasm@example.invalid', password });
  assert.equal(signup.status, 201, await signup.clone().text());
  const session = cookie(signup);
  const delivery = await fetch(base + '/api/three-and-out/preferences', {
    method: 'PUT',
    headers: { origin: base, cookie: session, 'content-type': 'application/json' },
    body: JSON.stringify({
      enabled: true,
      email: true,
      sms: false,
      push: false,
      timezone: 'America/Chicago',
      deliveryTime: '08:30',
    }),
  });
  assert.equal(delivery.status, 200, await delivery.clone().text());
  const pref = (await delivery.json()).preferences;
  assert.equal(pref.email, true);
  assert.equal(pref.timezone, 'America/Chicago');
  assert.equal(pref.deliveryTime, '08:30');
  assert.equal(
    sql("SELECT enabled FROM app_subscriptions WHERE topic='THREE_AND_OUT'")[0].enabled,
    1,
  );
  const changed = await fetch(base + '/api/three-and-out/preferences', {
    method: 'PUT',
    headers: { origin: base, cookie: session, 'content-type': 'application/json' },
    body: JSON.stringify({ enabled: false, email: true, sms: false, push: false }),
  });
  assert.equal(changed.status, 200, await changed.clone().text());
  assert.equal((await changed.json()).preferences.deliveryTime, '08:30');
  assert.equal(
    sql("SELECT enabled FROM app_subscriptions WHERE topic='THREE_AND_OUT'")[0].enabled,
    0,
  );

  assert.equal((await call('me', undefined, session)).status, 200);
  let credential = sql('SELECT * FROM app_credentials')[0];
  assert.match(credential.password_hash, /^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
  assert(await verify(credential.password_hash, password));
  const native = await hash(password, {
    algorithm: 2,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
    outputLen: 32,
  });
  sql(`UPDATE app_credentials SET password_hash='${native}'`);
  assert.equal(
    (await call('login', { email: 'wasm@example.invalid', password: 'incorrect' })).status,
    401,
  );
  const sessions = await Promise.all([
    call('login', { email: 'wasm@example.invalid', password }),
    call('login', { email: 'wasm@example.invalid', password }),
  ]);
  assert(
    sessions.every((r) => r.status === 200),
    await Promise.all(sessions.map((r) => r.clone().text())),
  );
  assert.notEqual(cookie(sessions[0]), cookie(sessions[1]));
  assert.equal((await call('logout', {}, cookie(sessions[0]))).status, 200);
  assert.equal((await call('me', undefined, cookie(sessions[0]))).status, 401);
  assert.equal((await call('me', undefined, cookie(sessions[1]))).status, 200);
  sql('UPDATE app_sessions SET expires_at=1');
  assert.equal((await call('me', undefined, session)).status, 401);
  assert.equal((await call('forgot-password', { email: 'wasm@example.invalid' })).status, 200);
  let token = '';
  for (const row of sql('SELECT object_hash FROM app_mail')) {
    const file = directory + '/mail-' + row.object_hash;
    let raw;
    if (process.env.DD_NO_R2 === 'true') {
      const rows = sql(
        `SELECT body FROM app_payload_chunks WHERE hash='${row.object_hash}' ORDER BY ordinal`,
      );
      raw = Buffer.concat(rows.map((r) => Buffer.from(r.body, 'base64')));
    } else {
      execute([
        'r2',
        'object',
        'get',
        `phase-four-local-objects/application/v1/${row.object_hash}`,
        '--local',
        '--persist-to',
        directory,
        '--file',
        file,
      ]);
      raw = await readFile(file);
    }
    if (raw[0] === 31 && raw[1] === 139) raw = (await import('node:zlib')).gunzipSync(raw);
    assert.equal(createHash('sha256').update(raw).digest('hex'), row.object_hash);
    const encrypted = JSON.parse(raw);
    const decipher = createDecipheriv(
      'aes-256-gcm',
      createHash('sha256').update(secret).digest(),
      Buffer.from(encrypted.iv, 'base64'),
    );
    const data = Buffer.from(encrypted.cipher, 'base64');
    decipher.setAuthTag(data.subarray(-16));
    const mail = JSON.parse(
      Buffer.concat([decipher.update(data.subarray(0, -16)), decipher.final()]),
    );
    if (mail.subject.startsWith('Reset'))
      token = new URL(mail.text.split(': ').at(-1)).searchParams.get('resetToken');
  }
  assert(token);
  const next = 'synthetic-new-password-🏈';
  assert.equal((await call('reset-password', { token, password: next })).status, 200);
  assert.notEqual((await call('reset-password', { token, password: next })).status, 200);
  assert.equal((await call('login', { email: 'wasm@example.invalid', password })).status, 401);
  const logged = await call('login', { email: 'wasm@example.invalid', password: next });
  assert.equal(logged.status, 200, await logged.clone().text());
  const persisted = cookie(logged);
  await stop();
  await start();
  assert.equal((await call('me', undefined, persisted)).status, 200);
  assert.equal(sql('PRAGMA foreign_key_check').length, 0);
  if (process.env.DD_NO_R2 === 'true') {
    await stop();
    const { encryptBackup, decryptBackup } = await import('./no-billing-backup.mjs');
    const owner = sql('SELECT id FROM app_users LIMIT 1')[0].id;
    const payload = Buffer.from(
      JSON.stringify({
        schema: 1,
        originalSaveId: 'offline-front-office',
        progress: { season: 2026, week: 7 },
        attribution: 'synthetic-original',
      }),
    );
    const payloadHash = createHash('sha256').update(payload).digest('hex');
    sql(
      `INSERT INTO app_payload_objects(hash,bytes,chunks,complete) VALUES('${payloadHash}',${payload.length},1,1)`,
    );
    sql(
      `INSERT INTO app_payload_chunks(hash,ordinal,body) VALUES('${payloadHash}',0,'${payload.toString('base64')}')`,
    );
    sql(`UPDATE app_payload_capacity SET used_bytes=used_bytes+${payload.length}`);
    sql(
      `INSERT INTO app_franchise_heads(user_id,save_id,team_abbr,season,phase,version,object_hash,created_at,updated_at) VALUES('${owner}','offline-front-office','KC',2026,'REGULAR',7,'${payloadHash}',1,1)`,
    );
    sql(
      `INSERT INTO app_saved_content(id,user_id,content_type,content_id,title,metadata_json,created_at) VALUES('offline-saved-bet','${owner}','OTHER','original-bet-id','Original bet','{"legs":[{"id":"original-market","line":42.5}]}',1)`,
    );
    sql(
      "INSERT INTO app_search(id,team_id,title,content,source_id,source_url) VALUES('offline-search','KC','Original historical article','Correction and original evidence','original-source','https://example.invalid/source')",
    );
    const exportFile = directory + '/frozen.sql';
    // Wrangler's native export rejects this application's FTS5 tables.
    const { logicalExport } = await import('./export-no-billing.mjs');
    const { Miniflare, convertV4MiniflareOptions } = await import('miniflare');
    const open = (persist) =>
      new Miniflare(
        convertV4MiniflareOptions({
          modules: true,
          script: 'export default {}',
          resourcePersistencePath: persist + '/v3',
          d1Databases: { APP_DB: '00000000-0000-0000-0000-000000000000' },
        }),
      );
    const sourceMf = open(directory),
      sourceDb = await sourceMf.getD1Database('APP_DB');
    const sourceQuery = async (command) => (await sourceDb.prepare(command).all()).results;
    try {
      await writeFile(exportFile, await logicalExport(sourceQuery), { mode: 0o600 });
      const original = await readFile(exportFile),
        key = (await import('node:crypto')).randomBytes(32);
      const encrypted = encryptBackup(original, key);
      assert.deepEqual(decryptBackup(encrypted, key), original);
      const tampered = Buffer.from(encrypted);
      tampered[tampered.length - 1] ^= 1;
      assert.throws(() => decryptBackup(tampered, key));
      const target = directory + '/restore';
      execute([
        'd1',
        'execute',
        'APP_DB',
        '--local',
        '--config',
        'wrangler.api-no-billing-local.toml',
        '--persist-to',
        target,
        '--file',
        exportFile,
      ]);
      const targetMf = open(target),
        targetDb = await targetMf.getD1Database('APP_DB');
      const targetSql = async (command) => (await targetDb.prepare(command).all()).results;
      try {
        for (const table of await sourceQuery(
          "SELECT s.name FROM sqlite_schema s JOIN pragma_table_list p ON p.name=s.name AND p.schema='main' WHERE s.type='table' AND p.type IN ('table','virtual') AND s.name NOT LIKE 'sqlite_%' AND s.name NOT LIKE '_cf_%' AND s.name NOT LIKE 'd1_%' ORDER BY s.name",
        )) {
          const name = '"' + table.name.replaceAll('"', '""') + '"';
          assert.deepEqual(
            await targetSql('SELECT * FROM ' + name),
            await sourceQuery('SELECT * FROM ' + name),
          );
        }
        assert.equal((await targetSql('PRAGMA foreign_key_check')).length, 0);
        assert.equal(
          (await targetSql("SELECT id FROM app_search WHERE app_search MATCH 'Correction'"))[0].id,
          'offline-search',
        );
      } finally {
        await targetMf.dispose();
      }
      await writeFile(
        out + '/offline-restore.json',
        JSON.stringify(
          {
            pass: true,
            source:
              'synthetic users, PHCs, sessions, preferences, saved bet, Front Office progress, historical FTS and all payload chunks',
            r2Bindings: false,
            postgres: false,
            encryptedBytes: encrypted.length,
            sqlBytes: original.length,
            allExportedTablesExact: true,
            tamperRejected: true,
            foreignKeyErrors: 0,
            rpoHours: 24,
            hostedRto: null,
          },
          null,
          2,
        ) + '\n',
      );
    } finally {
      await sourceMf.dispose();
    }
  }
  await writeFile(
    out + '/password-runtime.json',
    JSON.stringify(
      {
        runtime: 'actual local workerd via Wrangler with static Wasm service binding',
        databaseUrlPresent: false,
        d1WorkflowChecks: [
          'Three & Out channel preferences',
          'timezone and delivery-time preservation',
          'atomic email eligibility',
        ],
        nativePhcCompatible: true,
        argon2id: { memoryKiB: 19456, iterations: 2, parallelism: 1, hashBytes: 32 },
        scenarios: [
          'registration',
          'native-PHC login',
          'invalid credentials',
          'concurrent sessions',
          'logout isolation',
          'session expiry',
          'password reset',
          'single-use reset',
          'old password rejected',
          'restart',
        ],
        localSamples,
        hostedCpuMs: null,
      },
      null,
      2,
    ) + '\n',
  );
} finally {
  await stop();
  log.end();
  await rm(directory, { recursive: true, force: true });
}
