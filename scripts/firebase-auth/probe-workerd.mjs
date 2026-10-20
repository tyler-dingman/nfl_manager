/** Actual local workerd/OpenNext with real RSA verification; Firebase REST is synthetic and intercepted. */
import assert from 'node:assert/strict';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { readFile, readdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import * as sqlScript from '../../packages/storage/sql-script.ts';
const splitSql = sqlScript.splitSql ?? sqlScript.default.splitSql;
const root = process.cwd(),
  directory = await mkdtemp('/private/tmp/dd-blocker-ssr-'),
  out = process.env.DD_FIREBASE_PROBE_OUT ?? 'reports/firebase-auth',
  host = 'local-remediation.workers.dev',
  base = 'https://' + host,
  records = [];
const owners = [
  ...Array.from({ length: 8 }, (_, i) => 'D1_TEAM_' + (i + 1)),
  'D1_USERS',
  'D1_SHARED',
];
const bindings = {
  AUTH_PROVIDER: 'firebase',
  APP_AUTH_TIMINGS: 'true',
  FIREBASE_AUTH_ENABLED: 'true',
  FIREBASE_PROJECT_ID: 'synthetic-workerd-firebase',
  FIREBASE_API_KEY: 'public-workerd-fixture-key',
  FIREBASE_AUTH_DOMAIN: 'synthetic-workerd-firebase.firebaseapp.com',
  FIREBASE_APP_ID: 'synthetic-workerd-app',
  APP_MULTI_D1: 'true',
  APP_DATA_BACKEND: 'd1',
  APP_OBJECT_BACKEND: 'd1',
  APP_RUNTIME: 'cloudflare',
  APP_PASSWORD_ENABLED: 'false',
  APP_MAIL_ENABLED: 'false',
  APP_PUBLIC_CACHE_ENABLED: 'false',
  PRELAUNCH_MODE: 'false',
  SEARCH_ANSWER_PROVIDER: 'deterministic',
  AUTH_JWT_SECRET: 'local-ssr-remediation-synthetic-secret-64-characters-only',
  AUTH_BASE_URL: base,
  CONTENT_AUTOMATION_GLOBAL_ENABLED: 'false',
  APP_ODDS_FETCH_ENABLED: 'false',
  APP_EDITORIAL_EMAIL_ENABLED: 'false',
};
let outbound = 0,
  forbiddenOutbound = 0,
  revoked = false;
const pair = await generateKeyPair('RS256');
const jwk = { ...(await exportJWK(pair.publicKey)), kid: 'fixture', alg: 'RS256' };
const nowSeconds = Math.floor(Date.now() / 1000),
  issued = new Map();
const cookieMap = {},
  userIds = [];
async function token(uid, expiry = nowSeconds + 3600) {
  const jwt = await new SignJWT({
    auth_time: nowSeconds - 10,
    email: uid + '@example.invalid',
    email_verified: true,
  })
    .setSubject(uid)
    .setIssuer('https://securetoken.google.com/synthetic-workerd-firebase')
    .setAudience('synthetic-workerd-firebase')
    .setIssuedAt(nowSeconds)
    .setExpirationTime(expiry)
    .setProtectedHeader({ alg: 'RS256', kid: 'fixture' })
    .sign(pair.privateKey);
  issued.set(jwt, uid);
  return jwt;
}
const common = {
  modules: true,
  compatibilityDate: '2026-10-18',
  compatibilityFlags: ['nodejs_compat'],
  bindings,
  d1Databases: Object.fromEntries(owners.map((o) => [o, 'synthetic-ssr-' + o])),
  outboundService: async (request) => {
    outbound++;
    const url = new URL(request.url);
    if (
      request.url ===
      'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'
    )
      return Response.json({ keys: [jwk] });
    if (
      url.origin === 'https://identitytoolkit.googleapis.com' &&
      url.pathname === '/v1/accounts:lookup'
    ) {
      const { idToken } = await request.json(),
        uid = issued.get(idToken);
      if (uid)
        return Response.json({
          users: [{ localId: uid, validSince: String(revoked ? nowSeconds + 1 : nowSeconds - 30) }],
        });
      return Response.json({}, { status: 400 });
    }
    forbiddenOutbound++;
    return new Response('Unexpected external request forbidden', { status: 503 });
  },
};
const mf = new Miniflare(
  convertV4MiniflareOptions({
    resourcePersistencePath: directory,
    telemetry: { enabled: false },
    workers: [
      {
        ...common,
        name: 'web',
        scriptPath:
          process.env.DD_FIREBASE_WEB_BUNDLE ?? root + '/workers/web/dist/access-index.js',
        bindings: {
          ...bindings,
          STAGING_ACCESS_HOST: host,
          STAGING_ACCESS_SECRET:
            'synthetic_local_staging_secret_64_characters_for_tests_only_123456',
          STAGING_ACCESS_EXPIRES_AT: new Date(Date.now() + 3600000).toISOString(),
        },
        serviceBindings: {
          API_SERVICE: 'api',
          ASSETS: async (request) => {
            const path = new URL(request.url).pathname;
            if (path.includes('..')) return new Response(null, { status: 404 });
            try {
              return new Response(await readFile(root + '/.open-next/assets' + path));
            } catch {
              return new Response(null, { status: 404 });
            }
          },
        },
      },
      { ...common, name: 'api', scriptPath: root + '/workers/api/dist/worker.mjs' },
    ],
  }),
);
try {
  for (const owner of owners) {
    const db = await mf.getD1Database(owner, 'api'),
      role = owner === 'D1_USERS' ? 'users' : owner === 'D1_SHARED' ? 'shared' : 'team',
      path = root + '/workers/multi-d1/migrations/' + role + '/';
    for (const file of (await readdir(path)).filter((f) => f.endsWith('.sql')).sort())
      for (const sql of splitSql(await readFile(path + file, 'utf8'))) await db.prepare(sql).run();
  }
  const db = await mf.getD1Database('D1_USERS', 'api');
  const call = async (label, path, cookie, status) => {
    const r = await mf.dispatchFetch(base + path, {
      redirect: 'manual',
      headers: cookie ? { cookie } : {},
    });
    const text = await r.text();
    records.push({ label, path, status: r.status, expected: status, htmlBytes: text.length });
    assert.equal(r.status, status, label + ': ' + text.slice(0, 120));
    return { r, text };
  };
  await call('anonymous denied', '/', null, 403);
  const gate = await mf.dispatchFetch(base + '/__staging/access', {
    method: 'POST',
    redirect: 'manual',
    headers: {
      origin: base,
      'content-type': 'application/x-www-form-urlencoded',
      'cf-connecting-ip': '127.0.0.1',
    },
    body: new URLSearchParams({
      credential: 'synthetic_local_staging_secret_64_characters_for_tests_only_123456',
    }),
  });
  assert.equal(gate.status, 303);
  const stage = gate.headers.get('set-cookie').split(';')[0];
  for (const [i, label] of ['valid-a', 'valid-b', 'expired', 'revoked'].entries()) {
    const jwt = await token('synthetic-workerd-user-' + i);
    const response = await mf.dispatchFetch(base + '/api/auth/firebase/session', {
      method: 'POST',
      redirect: 'manual',
      headers: { cookie: stage, origin: base, 'content-type': 'application/json' },
      body: JSON.stringify({ idToken: jwt }),
    });
    const body = await response.json();
    assert.equal(response.status, 200, JSON.stringify(body));
    userIds.push(body.user.id);
    cookieMap[label] = response.headers.get('set-cookie').split(';')[0];
    if (label === 'expired')
      await db
        .prepare('UPDATE app_sessions SET expires_at=? WHERE user_id=?')
        .bind(Date.now() - 1000, body.user.id)
        .run();
    if (label === 'revoked')
      await db
        .prepare('UPDATE app_sessions SET revoked_at=? WHERE user_id=?')
        .bind(Date.now(), body.user.id)
        .run();
  }
  for (const idToken of ['forged.token.signature', await token('expired-jwt', nowSeconds - 1)]) {
    const response = await mf.dispatchFetch(base + '/api/auth/firebase/session', {
      method: 'POST',
      redirect: 'manual',
      headers: { cookie: stage, origin: base, 'content-type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
    assert.equal(response.status, 401);
  }

  const signedOut = await call('signed out redirects', '/', stage, 307);
  assert.equal(new URL(signedOut.r.headers.get('location'), base).pathname, '/login');
  for (const token of ['invalid', 'expired', 'revoked']) {
    const x = await call(
      token + ' session rejected',
      '/',
      stage + '; ' + (cookieMap[token] ?? 'dd_session=invalid'),
      307,
    );
    assert.equal(new URL(x.r.headers.get('location'), base).pathname, '/login');
  }
  for (const path of ['/', '/account', '/front-office', '/parlay-lab']) {
    const x = await call('signed-in HTML', path, stage + '; ' + cookieMap['valid-a'], 200);
    assert.match(x.text, /<html[\s>]/i);
    assert.match(x.r.headers.get('cache-control'), /private|no-store/);
  }
  await Promise.all(
    ['a', 'b'].map(async (id, i) => {
      const x = await call(
        'isolated session ' + id,
        '/api/auth/me',
        stage + '; ' + cookieMap['valid-' + id],
        200,
      );
      assert.equal(JSON.parse(x.text).user.id, userIds[i]);
    }),
  );
  revoked = true;
  await call(
    'provider revocation rejects session',
    '/api/auth/me',
    stage + '; ' + cookieMap['valid-a'],
    401,
  );
  assert.equal(forbiddenOutbound, 0, 'Only intercepted public keys and account lookup are allowed');
  await writeFile(
    out + '/firebase-ssr-workerd.json',
    JSON.stringify(
      {
        runtime: 'actual local workerd/OpenNext with ten synthetic D1 databases',
        records,
        interceptedFirebaseRequests: outbound,
        forbiddenOutboundRequests: forbiddenOutbound,
        hostedCPUQualified: false,
        passed: true,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(
    'Firebase actual local workerd/OpenNext PASS: RSA exchange, four signed-in pages, redirects, expiry, revocation, isolation; intercepted synthetic provider only',
  );
} finally {
  await mf.dispose();
  await rm(directory, { recursive: true, force: true });
}
