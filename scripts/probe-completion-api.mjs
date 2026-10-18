import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createServer } from 'node:net';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const out = 'reports/production-completion',
  directory = await mkdtemp(join(tmpdir(), 'dd-phase-three-worker-')),
  socket = createServer();
await new Promise((r) => socket.listen(0, '127.0.0.1', r));
const port = socket.address().port;
await new Promise((r) => socket.close(r));
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
  DATABASE_URL: '',
  PRODUCTION_DATABASE_URL: '',
  NODE_OPTIONS: '--require ./scripts/phase-two-network-guard.cjs',
});
const cli = ['node_modules/wrangler/bin/wrangler.js'],
  common = ['--local', '--config', 'wrangler.api-local.toml', '--persist-to', directory];
const migrated = spawnSync(
  process.execPath,
  [...cli, 'd1', 'migrations', 'apply', 'APP_DB', ...common],
  { env, encoding: 'utf8' },
);
await writeFile(`${out}/worker-local-migrations.log`, migrated.stdout + migrated.stderr);
if (migrated.status !== 0) throw Error('Synthetic Worker migrations failed');
const sessionToken = 'synthetic-existing-worker-session-token-32-characters',
  sessionHash = createHash('sha256').update(sessionToken).digest('hex'),
  now = Date.now(),
  owner = '00000000-0000-0000-0000-000000000003';
const seed = `INSERT INTO app_users(id,primary_email,email_verified,status,created_at,updated_at) VALUES('${owner}','worker@example.invalid',1,'ACTIVE',${now},${now}); INSERT INTO app_settings(user_id,updated_at) VALUES('${owner}',${now}); INSERT INTO app_sessions(id,user_id,refresh_token_hash,token_family_id,expires_at,created_at,last_used_at) VALUES('synthetic-session','${owner}','${sessionHash}','synthetic-family',${now + 86400000},${now},${now});`;
const triviaSeed = `INSERT INTO app_trivia_questions(id,team_id,question,answer_a,answer_b,answer_c,answer_d,correct_answer,explanation,category,verified) VALUES('worker-original-question','KC','Synthetic question?','a','b','c','d','A','Synthetic attribution','NFL',1);`;
await writeFile(join(directory, 'seed.sql'), seed + triviaSeed);
const seeded = spawnSync(
  process.execPath,
  [...cli, 'd1', 'execute', 'APP_DB', ...common, '--file', join(directory, 'seed.sql')],
  { env, encoding: 'utf8' },
);
if (seeded.status !== 0) throw Error('Synthetic Worker session seed failed');
const log = createWriteStream(`${out}/api-worker.log`),
  child = spawn(
    process.execPath,
    [
      'node_modules/wrangler/bin/wrangler.js',
      'dev',
      '--local',
      '--config',
      'wrangler.api-local.toml',
      '--ip',
      '127.0.0.1',
      '--port',
      String(port),
      '--persist-to',
      directory,
      '--var',
      'AUTH_JWT_SECRET:synthetic-worker-key-at-least-32-characters',
      '--var',
      'PRELAUNCH_MODE:false',
    ],
    { env, stdio: ['ignore', 'pipe', 'pipe'] },
  );
child.stdout.pipe(log, { end: false });
child.stderr.pipe(log, { end: false });
// NextURL canonicalizes loopback hosts to localhost; match browser origin.
const base = `http://localhost:${port}`,
  results = [];
let capabilityAssertionsPassed = 0;
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      const response = await fetch(`${base}/api/auth/config`, {
        signal: AbortSignal.timeout(1000),
      });
      if (response.status !== 503) {
        ready = true;
        break;
      }
    } catch {}
    if (child.exitCode !== null) throw Error('Local Worker exited');
    await new Promise((r) => setTimeout(r, 200));
  }
  if (!ready) throw Error('Local Worker did not start');
  for (const [name, path, method, body] of [
    ['Homepage', '/'],
    ['The Beat', '/the-beat?team=kc'],
    ['Film Room', '/watch?team=kc'],
    ['AI Search', '/api/search', 'POST', { query: 'Mahomes', teamId: 'KC', includeAnswer: false }],
    ['Front Office', '/front-office'],
    ['Parlay Lab', '/parlay-lab'],
    ['Trending Props', '/api/parlay-lab/props'],
    ['Bet Slip', '/parlay-lab/my-plays'],
    ['Authentication', '/api/auth/config'],
    ['Existing session', '/api/auth/me'],
    ['Saved IDs', '/api/user/saved-content'],
    ['Daily Trivia D1', '/api/trivia/daily?team=KC'],
    ['Editorial ingestion admission', '/api/automation/content', 'POST', {}],
  ]) {
    for (const attempt of ['cold', 'warm']) {
      const start = performance.now();
      try {
        const response = await fetch(`${base}${path}`, {
          method: method ?? 'GET',
          redirect: 'manual',
          headers: { 'content-type': 'application/json', cookie: `dd_session=${sessionToken}` },
          ...(body ? { body: JSON.stringify(body) } : {}),
          signal: AbortSignal.timeout(15000),
        });
        await response.text();
        results.push({
          name,
          path,
          attempt,
          status: response.status,
          localWallMs: performance.now() - start,
          workerCpuMs: null,
        });
      } catch (error) {
        results.push({ name, path, attempt, error: error.message, workerCpuMs: null });
      }
    }
  }
  const dailyResponse = await fetch(`${base}/api/trivia/daily?team=KC`, { headers: { cookie: `dd_session=${sessionToken}` } });
  assert.equal(dailyResponse.status, 200);
  const daily = await dailyResponse.json();
  assert(!('correctAnswer' in daily.dailyQuestion));
  const answerBody = { teamId: 'KC', dailyQuestionId: daily.dailyQuestion.id, questionId: daily.dailyQuestion.questionId, selectedAnswer: 'A', responseTimeMs: 0 };
  const submitDaily = () => fetch(`${base}/api/trivia/daily/answer`, { method: 'POST', headers: { cookie: `dd_session=${sessionToken}`, origin: base, 'content-type': 'application/json' }, body: JSON.stringify(answerBody) });
  const firstAnswer = await submitDaily(); assert.equal(firstAnswer.status, 200);
  const awarded = await firstAnswer.json(); assert.equal(awarded.accepted, true); assert.equal(awarded.moveTheChains.lifetimeYards, 1); capabilityAssertionsPassed++;
  const repeatedAnswer = await submitDaily(); assert.equal(repeatedAnswer.status, 200); assert.equal((await repeatedAnswer.json()).accepted, false); capabilityAssertionsPassed++;
  const config = await (await fetch(`${base}/api/auth/config`)).json();
  assert.equal(
    config.email,
    false,
    'Unqualified Worker password authentication must not be advertised as available',
  );
  capabilityAssertionsPassed++;
  assert.equal(
    (
      await fetch(`${base}/api/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: 'synthetic@example.invalid',
          password: 'synthetic-only-password',
        }),
      })
    ).status,
    503,
  );
  capabilityAssertionsPassed++;
  await writeFile(
    `${out}/api-worker-probe.json`,
    JSON.stringify(
      {
        scope:
          'MEASURED local workerd HTTP responses with empty disposable D1, no provider/account credentials. Not production CPU, complete D1 APIs, or a preview deployment.',
        capabilityAssertionsPassed,
        results,
      },
      null,
      2,
    ),
  );
} finally {
  await writeFile(
    `${out}/api-worker-probe.json`,
    JSON.stringify(
      {
        scope:
          'MEASURED local workerd with disposable empty D1; no cloud CPU or provider qualification.',
        capabilityAssertionsPassed,
        results,
      },
      null,
      2,
    ),
  );
  if (child.exitCode === null) {
    const stopped = new Promise((r) => child.once('exit', r));
    child.kill('SIGTERM');
    await stopped;
  }
  log.end();
  await rm(directory, { recursive: true, force: true });
}
