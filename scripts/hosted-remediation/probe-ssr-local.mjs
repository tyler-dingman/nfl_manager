/** Synthetic local workerd/OpenNext integration only. All outbound requests fail. */
import assert from 'node:assert/strict';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { readFile, readdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import * as sqlScript from '../../packages/storage/sql-script.ts';
const splitSql = sqlScript.splitSql ?? sqlScript.default.splitSql;
const root = process.cwd(),
  directory = await mkdtemp('/private/tmp/dd-blocker-ssr-'),
  out = 'reports/hosted-blocker-remediation',
  host = 'local-remediation.workers.dev',
  base = 'https://' + host,
  records = [];
const owners = [
  ...Array.from({ length: 8 }, (_, i) => 'D1_TEAM_' + (i + 1)),
  'D1_USERS',
  'D1_SHARED',
];
const bindings = {
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
let outbound = 0;
const common = {
  modules: true,
  compatibilityDate: '2026-10-18',
  compatibilityFlags: ['nodejs_compat'],
  bindings,
  d1Databases: Object.fromEntries(owners.map((o) => [o, 'synthetic-ssr-' + o])),
  outboundService: () => {
    outbound++;
    return new Response('External network forbidden', { status: 503 });
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
        scriptPath: root + '/workers/web/dist/access-index.js',
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
  const db = await mf.getD1Database('D1_USERS', 'api'),
    now = Date.now();
  for (const [i, token] of ['valid-a', 'valid-b', 'expired', 'revoked'].entries()) {
    const user = 'synthetic-ssr-user-' + i;
    await db
      .prepare(
        "INSERT INTO app_users(id,primary_email,email_verified,status,created_at,updated_at) VALUES(?,?,1,'ACTIVE',?,?)",
      )
      .bind(user, `ssr-${i}@example.invalid`, now, now)
      .run();
    await db
      .prepare(
        'INSERT INTO app_sessions(id,user_id,refresh_token_hash,token_family_id,expires_at,created_at,last_used_at,revoked_at) VALUES(?,?,?,?,?,?,?,?)',
      )
      .bind(
        'session-' + i,
        user,
        createHash('sha256').update(token).digest('hex'),
        'family-' + i,
        token === 'expired' ? now - 1000 : now + 3600000,
        now,
        now,
        token === 'revoked' ? now : null,
      )
      .run();
  }
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
  const signedOut = await call('signed out redirects', '/', stage, 307);
  assert.equal(new URL(signedOut.r.headers.get('location'), base).pathname, '/login');
  for (const token of ['invalid', 'expired', 'revoked']) {
    const x = await call(token + ' session rejected', '/', stage + '; dd_session=' + token, 307);
    assert.equal(new URL(x.r.headers.get('location'), base).pathname, '/login');
  }
  for (const path of ['/', '/account', '/front-office', '/parlay-lab']) {
    const x = await call('signed-in HTML', path, stage + '; dd_session=valid-a', 200);
    assert.match(x.text, /<html[\s>]/i);
    assert.match(x.r.headers.get('cache-control'), /private|no-store/);
  }
  await Promise.all(
    ['a', 'b'].map(async (id, i) => {
      const x = await call(
        'isolated session ' + id,
        '/api/auth/me',
        stage + '; dd_session=valid-' + id,
        200,
      );
      assert.equal(JSON.parse(x.text).user.id, 'synthetic-ssr-user-' + i);
    }),
  );
  assert.equal(outbound, 0, 'SSR must not depend on public self-fetch or provider requests');
  await writeFile(
    out + '/ssr-workerd.json',
    JSON.stringify(
      {
        runtime: 'actual local workerd/OpenNext with ten synthetic D1 databases',
        records,
        outboundRequests: outbound,
        hostedCPUQualified: false,
        passed: true,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(
    'Local SSR workerd PASS: staging gate, sign-in/out, invalid/expired/revoked sessions, four pages, user isolation; zero outbound requests',
  );
} finally {
  await mf.dispose();
  await rm(directory, { recursive: true, force: true });
}
