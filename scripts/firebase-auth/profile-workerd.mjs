import { createHash } from 'node:crypto';
/** Offline-only profiling of the existing API bundle. No deployment or live credentials. */
import assert from 'node:assert/strict';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { readFile, readdir, mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import WebSocket from 'ws';
import * as sqlModule from '../../packages/storage/sql-script.ts';
const splitSql = sqlModule.splitSql ?? sqlModule.default.splitSql;
const out = process.env.DD_PROFILE_OUT ?? 'reports/firebase-cpu-root-cause';
await mkdir(out, { recursive: true });
const dir = await mkdtemp('/private/tmp/dd-worker-profile-'),
  owners = [...Array.from({ length: 8 }, (_, i) => 'D1_TEAM_' + (i + 1)), 'D1_USERS', 'D1_SHARED'];
const project = 'synthetic-cpu-profile',
  now = Math.floor(Date.now() / 1000),
  pair = await generateKeyPair('RS256'),
  jwk = { ...(await exportJWK(pair.publicKey)), kid: 'fixture', alg: 'RS256' },
  issued = new Map();
let keyFetches = 0,
  providerLookups = 0,
  unexpectedOutbound = 0,
  current,
  ws;
const metrics = [],
  rows = [];
const mf = new Miniflare(
  convertV4MiniflareOptions({
    inspectorPort: 0,
    resourcePersistencePath: dir,
    telemetry: { enabled: false },
    workers: [
      {
        name: 'api',
        ...(process.env.DD_PROFILE_LAZY === 'true'
          ? {
              modules: [
                {
                  type: 'ESModule',
                  path: 'entry.mjs',
                  contents: `let api; async function load(){return api??=await import('./worker.mjs')} export default {async fetch(r,e,c){const m=await load();return new URL(r.url).pathname==='/__profile/load'?new Response('loaded'):m.default.fetch(r,e,c)}}`,
                },
                {
                  type: 'ESModule',
                  path: 'worker.mjs',
                  contents: await readFile(
                    process.env.DD_PROFILE_BUNDLE ?? process.cwd() + '/workers/api/dist/worker.mjs',
                    'utf8',
                  ),
                },
              ],
            }
          : {
              modules: true,
              scriptPath:
                process.env.DD_PROFILE_BUNDLE ?? process.cwd() + '/workers/api/dist/worker.mjs',
            }),
        compatibilityDate: '2026-10-18',
        compatibilityFlags: ['nodejs_compat'],

        d1Databases: Object.fromEntries(owners.map((o) => [o, 'cpu-fixture-' + o])),
        bindings: {
          AUTH_PROVIDER: 'firebase',
          FIREBASE_AUTH_ENABLED: 'true',
          FIREBASE_PROJECT_ID: project,
          FIREBASE_API_KEY: 'synthetic-key',
          FIREBASE_APP_ID: 'synthetic-app',
          FIREBASE_AUTH_DOMAIN: project + '.firebaseapp.com',
          APP_MULTI_D1: 'true',
          APP_DATA_BACKEND: 'd1',
          APP_OBJECT_BACKEND: 'd1',
          APP_RUNTIME: 'cloudflare',
          APP_PASSWORD_ENABLED: 'false',
          APP_AUTH_TIMINGS: 'true',
          AUTH_JWT_SECRET: 'synthetic-cpu-profile-secret-at-least-64-characters-only',
          AUTH_BASE_URL: 'https://local-profile.workers.dev',
          APP_MAIL_ENABLED: 'false',
          APP_ODDS_FETCH_ENABLED: 'false',
          CONTENT_AUTOMATION_GLOBAL_ENABLED: 'false',
          APP_EDITORIAL_EMAIL_ENABLED: 'false',
          SEARCH_ANSWER_PROVIDER: 'deterministic',
        },
        outboundService: async (request) => {
          if (
            request.url ===
            'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'
          ) {
            keyFetches++;
            return Response.json({ keys: [jwk] });
          }
          if (
            new URL(request.url).origin === 'https://identitytoolkit.googleapis.com' &&
            new URL(request.url).pathname === '/v1/accounts:lookup'
          ) {
            providerLookups++;
            const body = await request.json(),
              uid = issued.get(body.idToken);
            return uid
              ? Response.json({ users: [{ localId: uid, validSince: String(now - 60) }] })
              : Response.json({}, { status: 400 });
          }
          unexpectedOutbound++;
          return new Response('External network forbidden', { status: 503 });
        },
      },
    ],
  }),
);
try {
  for (const owner of owners) {
    const db = await mf.getD1Database(owner, 'api'),
      role = owner === 'D1_USERS' ? 'users' : owner === 'D1_SHARED' ? 'shared' : 'team',
      base = process.cwd() + '/workers/multi-d1/migrations/' + role + '/';
    for (const file of (await readdir(base)).filter((x) => x.endsWith('.sql')).sort())
      for (const sql of splitSql(await readFile(base + file, 'utf8'))) await db.prepare(sql).run();
  }
  const db = await mf.getD1Database('D1_USERS', 'api');
  await db.prepare('INSERT OR IGNORE INTO app_storage_epoch(id,epoch,locked) VALUES(1,0,0)').run();
  const inspector = await mf.getInspectorURL();
  inspector.protocol = 'http:';
  inspector.pathname = '/json/list';
  const targets = await (await fetch(inspector)).json(),
    target = targets.find((t) => t.id === 'core:user:api');
  assert(target, 'API debugger target missing');
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.once('open', resolve);
    ws.once('error', reject);
  });
  let id = 0;
  const pending = new Map();
  ws.on('message', (data) => {
    const m = JSON.parse(data.toString());
    if (m.id) {
      const p = pending.get(m.id);
      if (p) {
        pending.delete(m.id);
        clearTimeout(p.timer);
        m.error ? p.reject(Error(m.error.message)) : p.resolve(m.result);
      }
    }
    if (m.method === 'Runtime.consoleAPICalled')
      for (const arg of m.params.args ?? [])
        try {
          const v = JSON.parse(arg.value);
          if (v.metric === 'application_headers') metrics.push({ operation: current, ...v });
        } catch {}
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const n = ++id;
      const timer = setTimeout(() => {
        pending.delete(n);
        reject(Error('Inspector timeout: ' + method));
      }, 15000);
      pending.set(n, { resolve, reject, timer });
      ws.send(JSON.stringify({ id: n, method, params }));
    });
  await send('Runtime.enable');
  await send('Profiler.enable');
  await send('Profiler.setSamplingInterval', { interval: 100 });
  if (process.env.DD_PROFILE_LAZY === 'true') {
    current = 'module-startup';
    await send('Profiler.start');
    const start = performance.now();
    const response = await mf.dispatchFetch('https://local-profile.workers.dev/__profile/load');
    assert.equal(response.status, 200);
    await response.text();
    const { profile } = await send('Profiler.stop');
    const file = 'module-startup.cpuprofile';
    await writeFile(out + '/' + file, JSON.stringify(profile));
    rows.push({
      operation: current,
      status: response.status,
      wallMs: performance.now() - start,
      profile: file,
      samples: profile.samples?.length ?? 0,
      profileDurationMs: (profile.endTime - profile.startTime) / 1000,
      metrics: [],
    });
    console.log('module-startup: ' + profile.samples?.length + ' CPU-profile samples');
  }
  let previous;
  const warmCount = Number(process.env.DD_PROFILE_WARM_COUNT ?? 2);
  assert(Number.isInteger(warmCount) && warmCount >= 2 && warmCount <= 50);
  const cases = [
    'first-web',
    ...Array(warmCount).fill('new-web'),
    ...Array(warmCount).fill('existing-web'),
    'native',
  ];
  for (const [index, kind] of cases.entries()) {
    const uid = kind === 'existing-web' ? 'profile-' + warmCount : 'profile-' + index;
    const jwt = await new SignJWT({
      auth_time: now - 10,
      email: uid + '@example.invalid',
      email_verified: true,
    })
      .setSubject(uid)
      .setAudience(project)
      .setIssuer('https://securetoken.google.com/' + project)
      .setIssuedAt(now)
      .setExpirationTime(now + 3600)
      .setProtectedHeader({ alg: 'RS256', kid: 'fixture' })
      .sign(pair.privateKey);
    issued.set(jwt, uid);
    current = String(index) + '-' + kind;
    const metricStart = metrics.length;
    await send('Profiler.start');
    const start = performance.now();
    const r = await mf.dispatchFetch(
      'https://local-profile.workers.dev/api/auth/firebase/session',
      {
        method: 'POST',
        headers: {
          origin: 'https://local-profile.workers.dev',
          'content-type': 'application/json',
          ...(kind === 'existing-web' && previous ? { cookie: previous } : {}),
        },
        body: JSON.stringify({ idToken: jwt, mobile: kind === 'native' }),
      },
    );
    const body = await r.json(),
      wallMs = performance.now() - start;
    const { profile } = await send('Profiler.stop');
    assert.equal(r.status, 200);
    assert(body.user?.id);
    assert.equal(Boolean(body.accessToken), kind === 'native');
    if (kind !== 'native') previous = r.headers.get('set-cookie')?.split(';')[0];
    const file = current + '.cpuprofile';
    await writeFile(out + '/' + file, JSON.stringify(profile));
    const nodes = new Map(profile.nodes.map((n) => [n.id, n])),
      self = new Map();
    for (let i = 0; i < (profile.samples ?? []).length; i++)
      self.set(profile.samples[i], (self.get(profile.samples[i]) ?? 0) + 1);
    const top = [...self]
      .map(([id, samples]) => ({
        function: nodes.get(id).callFrame.functionName,
        url: nodes.get(id).callFrame.url,
        line: nodes.get(id).callFrame.lineNumber + 1,
        samples,
      }))
      .sort((a, b) => b.samples - a.samples);
    rows.push({
      operation: current,
      status: r.status,
      wallMs,
      profile: file,
      samples: profile.samples?.length ?? 0,
      profileDurationMs: (profile.endTime - profile.startTime) / 1000,
      topSelf: top.slice(0, 30),
      metrics: metrics.slice(metricStart),
    });
    console.log(current + ': ' + profile.samples?.length + ' CPU-profile samples');
  }
  assert.equal(unexpectedOutbound, 0);
  assert.equal(keyFetches, 1);
  assert.equal(providerLookups, cases.length);
  assert(rows.every((r) => r.samples > 0));
  await writeFile(
    out + '/workerd-profile-summary.json',
    JSON.stringify(
      {
        source:
          'Actual local workerd V8 sampling profiler, API isolate only. Samples and elapsed wall time are NOT hosted CPU accounting. D1 service isolate and native crypto helper-thread CPU are not included.',
        bundle: process.env.DD_PROFILE_BUNDLE ?? 'workers/api/dist/worker.mjs',
        bundleSha256: createHash('sha256')
          .update(
            await readFile(
              process.env.DD_PROFILE_BUNDLE ?? process.cwd() + '/workers/api/dist/worker.mjs',
            ),
          )
          .digest('hex'),
        samplingIntervalMicroseconds: 100,
        lazyModuleControl: process.env.DD_PROFILE_LAZY === 'true',
        keyFetches,
        providerLookups,
        unexpectedOutbound,
        rows,
      },
      null,
      2,
    ) + '\n',
  );
} finally {
  ws?.close();
  await mf.dispose();
  await rm(dir, { recursive: true, force: true });
}
