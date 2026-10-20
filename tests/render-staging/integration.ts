import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import next from 'next';
import { chromium } from '@playwright/test';
import { initializeApp, deleteApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  getIdToken,
  signOut,
  connectAuthEmulator,
} from 'firebase/auth';
import { nativeFixture, publicOrigin as nativePublicOrigin } from '../execution-boundary/fixture';
import { restFixture, listen, close } from './fixture';
import { firebaseFixture } from './firebase-fixture';
import { seedStories } from './product-fixtures';
import { createNodeOrigin } from '../../src/server/node-staging/origin-server';
import edge from '../../workers/staging/render-origin';
import { TEAM_GROUPS } from '../../packages/storage/multi-d1';
async function main() {
  const nativeBoundary = process.env.DD_TEST_NATIVE_BOUNDARY === 'true';
  const out = nativeBoundary ? 'reports/execution-boundary' : 'reports/render-free-prototype';
  await mkdir(out, { recursive: true });
  const f = await (nativeBoundary ? nativeFixture() : restFixture()),
    firebase = await firebaseFixture(),
    originalFetch = globalThis.fetch;
  const publicOrigin = nativeBoundary ? nativePublicOrigin : 'https://local-render.workers.dev',
    configuration = {
      secret: 'synthetic-render-origin-secret-independent-and-64-characters-long-only',
      audience: 'dd-render-staging',
      publicOrigin,
    };
  const env = {
    NODE_ENV: 'production',
    DD_NODE_STAGING: 'true',
    DD_NODE_PUBLIC_ORIGIN: publicOrigin,
    DD_NODE_ORIGIN_SECRET: configuration.secret,
    DD_NODE_AUDIENCE: configuration.audience,
    AUTH_PROVIDER: 'firebase',
    FIREBASE_AUTH_ENABLED: 'true',
    FIREBASE_PROJECT_ID: firebase.configuration.projectId,
    FIREBASE_API_KEY: firebase.configuration.apiKey,
    FIREBASE_APP_ID: firebase.configuration.appId,
    FIREBASE_AUTH_DOMAIN: firebase.configuration.authDomain,
    AUTH_JWT_SECRET: 'synthetic-render-application-secret-different-and-at-least-64-characters',
    AUTH_BASE_URL: publicOrigin,
    APP_MULTI_D1: 'true',
    APP_DATA_BACKEND: 'd1',
    APP_OBJECT_BACKEND: 'd1',
    APP_RUNTIME: 'node',
    APP_PASSWORD_ENABLED: 'false',
    APP_MAIL_ENABLED: 'false',
    APP_PUBLIC_CACHE_ENABLED: 'false',
    PRELAUNCH_MODE: 'false',
    CONTENT_AUTOMATION_GLOBAL_ENABLED: 'false',
    APP_ODDS_FETCH_ENABLED: 'false',
    APP_EDITORIAL_EMAIL_ENABLED: 'false',
    SEARCH_ANSWER_PROVIDER: 'deterministic',
  };
  const savedEnv = { ...process.env };
  Object.assign(process.env, env);
  const records: any[] = [];
  let nodeUrl = '',
    nodeServer: any,
    edgeServer: any,
    providerServer: any,
    browser: any,
    app: any;
  const fixtureApp = initializeApp(firebase.configuration, 'render-local-test');
  globalThis.fetch = (async (input: any, init?: RequestInit) => {
    const r = input instanceof Request ? input : new Request(input, init);
    const handled = await firebase.respond(
      r.url,
      r.method === 'POST' ? await r.clone().text() : '',
    );
    if (handled) return handled;
    if (new URL(r.url).origin === 'https://synthetic.onrender.com')
      return originalFetch(nodeUrl + new URL(r.url).pathname + new URL(r.url).search, {
        method: r.method,
        headers: r.headers,
        ...(!['GET', 'HEAD'].includes(r.method) ? { body: await r.arrayBuffer() } : {}),
        redirect: 'manual',
      });
    assert(
      ['127.0.0.1', 'localhost', '[::1]'].includes(new URL(r.url).hostname),
      'Unexpected external request',
    );
    return originalFetch(input, init);
  }) as typeof fetch;
  async function record(label: string, pass: boolean, data: Record<string, unknown> = {}) {
    records.push({ label, pass, ...data });
    await writeFile(
      out + '/integration.json',
      JSON.stringify({ records, passed: false }, null, 2) + '\n',
    );
    assert(pass, label);
    console.log('PASS ' + label);
  }
  try {
    const api = await import(pathToFileURL(process.cwd() + '/.staging/render-node/api.mjs').href);
    app = next({
      dev: false,
      dir: process.cwd() + '/.staging/render-node/app',
      hostname: new URL(publicOrigin).hostname,
      port: 443,
    });
    await app.prepare();
    nodeServer = createNodeOrigin({
      configuration,
      bindings: f.bindings,
      env,
      api: api.default,
      next: app.getRequestHandler(),
    });
    nodeUrl = await listen(nodeServer);
    process.env.DD_NODE_INTERNAL_URL = nodeUrl;
    const assets = async (request: Request) => {
      const pathname = decodeURIComponent(new URL(request.url).pathname);
      const base = pathname.startsWith('/_next/static/')
        ? process.cwd() + '/.staging/render-node/assets/_next/static'
        : process.cwd() + '/.staging/render-node/assets';
      const rel = pathname.startsWith('/_next/static/')
          ? pathname.slice('/_next/static/'.length)
          : pathname.slice(1),
        file = path.resolve(base, rel);
      if (!file.startsWith(path.resolve(base) + '/')) return new Response(null, { status: 404 });
      try {
        const body = await readFile(file);
        return new Response(body, {
          headers: {
            'content-type': file.endsWith('.js')
              ? 'application/javascript'
              : file.endsWith('.css')
                ? 'text/css'
                : file.endsWith('.svg')
                  ? 'image/svg+xml'
                  : 'application/octet-stream',
          },
        });
      } catch {
        return new Response(null, { status: 404 });
      }
    };
    const edgeEnv = {
      ...env,
      DD_NODE_ORIGIN_SECRET: configuration.secret,
      RENDER_STAGING_ORIGIN: 'https://synthetic.onrender.com',
      STAGING_ACCESS_HOST: new URL(publicOrigin).hostname,
      STAGING_ACCESS_SECRET:
        'synthetic-edge-gate-secret-at-least-64-characters-only-for-local-fixture',
      STAGING_ACCESS_EXPIRES_AT: new Date(Date.now() + 3600000).toISOString(),
      D1_USERS: f.h.db.D1_USERS,
      ASSETS: { fetch: assets },
    };
    edgeServer = createServer(async (req, res) => {
      try {
        const parts = [];
        for await (const part of req) parts.push(part);
        const body = Buffer.concat(parts),
          request = new Request(publicOrigin + req.url, {
            method: req.method,
            headers: {
              ...(req.headers as Record<string, string>),
              'cf-connecting-ip': '127.0.0.1',
            },
            ...(!['GET', 'HEAD'].includes(req.method ?? 'GET') ? { body } : {}),
            redirect: 'manual',
          });
        const reply = await edge.fetch(request, edgeEnv, {});
        res.statusCode = reply.status;
        for (const [k, v] of reply.headers) if (k !== 'set-cookie') res.setHeader(k, v);
        const cookies = reply.headers.getSetCookie();
        if (cookies.length) res.setHeader('set-cookie', cookies);
        res.end(Buffer.from(await reply.arrayBuffer()));
      } catch {
        res.writeHead(503);
        res.end('Local fixture failed');
      }
    });
    const edgeUrl = await listen(edgeServer);
    await record(
      'Direct origin denied',
      (await originalFetch(nodeUrl + '/api/auth/config')).status === 403,
    );
    await record(
      'Anonymous edge denied',
      (await originalFetch(edgeUrl + '/api/auth/config')).status === 403,
    );
    for (const route of ['/', '/account', '/favicon.ico', '/api/auth/me']) {
      await record(
        'Direct origin denied ' + route,
        (
          await originalFetch(nodeUrl + route, {
            headers: { 'x-dd-user': 'forged', 'x-forwarded-host': 'trusted.invalid' },
            redirect: 'manual',
          })
        ).status === 403,
      );
      await record(
        'Anonymous edge denied ' + route,
        (await originalFetch(edgeUrl + route, { redirect: 'manual' })).status === 403,
      );
    }
    await record(
      'Invalid staging credential denied',
      (
        await originalFetch(edgeUrl + '/__staging/access', {
          method: 'POST',
          redirect: 'manual',
          headers: { origin: publicOrigin, 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ credential: 'synthetic-invalid' }),
        })
      ).status === 401,
    );
    const gate = await originalFetch(edgeUrl + '/__staging/access', {
      method: 'POST',
      redirect: 'manual',
      headers: { origin: publicOrigin, 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ credential: edgeEnv.STAGING_ACCESS_SECRET }),
    });
    assert.equal(gate.status, 303);
    const stage = gate.headers.get('set-cookie')!.split(';')[0];
    let session = '';
    async function call(label: string, p: string, status = 200, body?: unknown, cookie = session) {
      const response = await originalFetch(edgeUrl + p, {
        method: body ? 'POST' : 'GET',
        redirect: 'manual',
        headers: {
          cookie: stage + (cookie ? '; ' + cookie : ''),
          origin: publicOrigin,
          'content-type': 'application/json',
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const text = await response.text();
      await record(label, response.status === status, { path: p, status: response.status });
      let json: any;
      try {
        json = JSON.parse(text);
      } catch {}
      return { response, text, json };
    }
    providerServer = createServer(async (req, res) => {
      const parts = [];
      for await (const part of req) parts.push(part);
      const match = (req.url ?? '').match(
        /^\/(identitytoolkit.googleapis.com|securetoken.googleapis.com)(\/.*)$/,
      );
      const response = match
        ? await firebase.respond('https://' + match[1] + match[2], Buffer.concat(parts).toString())
        : null;
      res.setHeader('content-type', 'application/json');
      res.statusCode = response?.status ?? 400;
      res.end(response ? await response.text() : '{}');
    });
    const providerUrl = await listen(providerServer);
    const auth = getAuth(fixtureApp);
    connectAuthEmulator(auth, providerUrl, { disableWarnings: true });
    const a = await createUserWithEmailAndPassword(
      auth,
      'node-a@example.invalid',
      'synthetic-password-strong-1!',
    );
    const aToken = await getIdToken(a.user);
    const exchange = await call(
      'Registration and real RSA identity exchange',
      '/api/auth/firebase/session',
      200,
      { idToken: aToken },
    );
    session = exchange.response.headers.get('set-cookie')!.split(';')[0];
    let sessionA = session;
    const userA = exchange.json.user.id;
    assert(!exchange.json.accessToken);
    assert(exchange.response.headers.get('set-cookie')?.includes('Secure'));
    await call('Node session lookup', '/api/auth/me');
    await signOut(auth);
    await assert.rejects(
      signInWithEmailAndPassword(auth, 'node-a@example.invalid', 'invalid-password'),
    );
    const login = await signInWithEmailAndPassword(
      auth,
      'node-a@example.invalid',
      'synthetic-password-strong-1!',
    );
    const logged = await call(
      'Firebase login exchange preserves application UUID',
      '/api/auth/firebase/session',
      200,
      { idToken: await getIdToken(login.user, true) },
    );
    assert.equal(logged.json.user.id, userA);
    session = logged.response.headers.get('set-cookie')!.split(';')[0];
    sessionA = session;
    const b = await createUserWithEmailAndPassword(
      auth,
      'node-b@example.invalid',
      'synthetic-password-strong-2!',
    );
    const bExchange = await call(
      'Second synthetic account',
      '/api/auth/firebase/session',
      200,
      { idToken: await getIdToken(b.user) },
      '',
    );
    const sessionB = bExchange.response.headers.get('set-cookie')!.split(';')[0];
    assert.notEqual(bExchange.json.user.id, userA);
    const native = await call(
      'Native Firebase exchange retains bearer session',
      '/api/auth/firebase/session',
      200,
      { idToken: aToken, mobile: true },
      '',
    );
    assert(native.json.accessToken && native.json.refreshToken);
    const nativeMe = await originalFetch(edgeUrl + '/api/auth/me', {
      headers: { cookie: stage, authorization: 'Bearer ' + native.json.accessToken },
    });
    await record('Native bearer verified on Node API', nativeMe.status === 200);
    await seedStories(f.bindings);
    for (const team of [...TEAM_GROUPS.flat(), 'NFL']) {
      const r = await call('Team/global feed ' + team, '/api/content/huddle?team=' + team);
      assert(r.text.includes('render-fixture-' + team));
    }
    for (const team of ['KC', 'BUF', 'NFL'])
      await call('Cross-shard save ' + team, '/api/user/saved-content', 201, {
        contentType: 'STORY',
        contentId: 'render-fixture-' + team,
        title: 'Synthetic ' + team,
        href: '/content/render-fixture-' + team,
      });
    const saved = await call('Saved cross-shard identities preserved', '/api/user/saved-content');
    assert(saved.text.includes('render-fixture-NFL'));
    const foreign = await call(
      'Cross-user saves isolated',
      '/api/user/saved-content',
      200,
      undefined,
      sessionB,
    );
    assert(!foreign.text.includes('render-fixture-'));
    const command = crypto.randomUUID();
    const createOptions = {
      method: 'POST',
      headers: {
        cookie: stage + '; ' + sessionA,
        origin: publicOrigin,
        'content-type': 'application/json',
        'X-Franchise-Version': '0',
        'X-Franchise-Command-Id': command,
      },
      body: JSON.stringify({ teamAbbr: 'KC', fresh: true }),
    };
    const created = await originalFetch(edgeUrl + '/api/saves/create', createOptions);
    const createdBody = await created.json();
    await record('Front Office full durable creation', created.status === 200, {
      status: created.status,
    });
    const saveId = createdBody.saveId;
    const replay = await originalFetch(edgeUrl + '/api/saves/create', createOptions);
    const replayBody = await replay.json();
    await record(
      'Front Office idempotent command replay',
      replay.status === 200 && replayBody.saveId === saveId,
    );
    const changed = await originalFetch(edgeUrl + '/api/saves/create', {
      ...createOptions,
      body: JSON.stringify({ teamAbbr: 'BUF', fresh: true }),
    });
    await record('Front Office conflicting command rejected', changed.status === 409, {
      status: changed.status,
    });
    const front = await call('Front Office readback', '/api/front-office/state?saveId=' + saveId);
    assert(front.text.includes(saveId));
    await call(
      'Front Office cross-user isolation',
      '/api/front-office/state?saveId=' + saveId,
      404,
      undefined,
      sessionB,
    );
    for (const p of [
      '/api/parlay-lab/events',
      '/api/parlay-lab/props?team=KC',
      '/api/parlay-lab/freshness',
    ])
      await call('Parlay Lab synthetic API ' + p, p);
    await call('Saved synthetic bet', '/api/user/saved-content', 201, {
      contentType: 'OTHER',
      contentId: 'synthetic-bet',
      title: 'Synthetic bet',
      metadata: {
        kind: 'PARLAY',
        play: {
          selections: [
            { eventId: 'synthetic-event', market: 'MONEYLINE', selection: 'KC', odds: -110 },
          ],
          synthetic: true,
        },
      },
    });
    await call('Invalid Firebase token denied', '/api/auth/firebase/session', 401, {
      idToken: 'forged.invalid.token',
    });
    for (const p of ['/', '/front-office', '/parlay-lab', '/account']) {
      const r = await call('Authenticated Node SSR ' + p, p);
      assert(r.response.headers.get('content-type')?.includes('text/html'));
    }
    const signedOut = await call('Signed-out redirect', '/', 307, undefined, '');
    assert(
      new URL(signedOut.response.headers.get('location')!, publicOrigin).pathname === '/login',
    );
    // Browser requests never leave the fixture: public host and Firebase SDK HTTP are intercepted.
    browser = await chromium.launch({ headless: true, channel: 'chrome' });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    let blocked = 0;
    await context.route('**/*', async (route: import('@playwright/test').Route) => {
      const request = route.request(),
        url = new URL(request.url());
      if (url.origin === publicOrigin) {
        const response = await originalFetch(edgeUrl + url.pathname + url.search, {
          method: request.method(),
          headers: request.headers(),
          ...(request.postDataBuffer() ? { body: request.postDataBuffer()! as BodyInit } : {}),
          redirect: 'manual',
        });
        await route.fulfill({
          status: response.status,
          headers: Object.fromEntries(response.headers),
          body: Buffer.from(await response.arrayBuffer()),
        });
        return;
      }
      const response = await firebase.respond(url.href, request.postData() ?? '');
      if (response) {
        await route.fulfill({
          status: response.status,
          headers: {
            'content-type': 'application/json',
            'access-control-allow-origin': publicOrigin,
          },
          body: await response.text(),
        });
        return;
      }
      blocked++;
      await route.abort();
    });
    await context.addCookies([
      {
        name: '__Host-dd_staging',
        value: stage.split('=').slice(1).join('='),
        url: publicOrigin,
        httpOnly: true,
        secure: true,
        sameSite: 'Strict',
      },
      {
        name: 'dd_session',
        value: sessionA.split('=').slice(1).join('='),
        url: publicOrigin,
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
      },
    ]);
    const page = await context.newPage();
    await page.goto(publicOrigin + '/account', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await record(
      'Responsive browser protected account renders',
      !page.url().includes('/login') && (await page.locator('body').innerText()).length > 100,
    );
    await page.screenshot({ path: out + '/browser-account.png', fullPage: false });
    await context.close();
    await browser.close();
    browser = undefined;
    await call('Logout', '/api/auth/logout', 200, {});
    await call('Revoked session denied', '/api/auth/me', 401, undefined, sessionA);
    await call('Other user session survives logout', '/api/auth/me', 200, undefined, sessionB);
    await call(
      'Cross-user deletion proof rejected',
      '/api/user/account/delete',
      500,
      { confirmation: 'DELETE', idToken: aToken },
      sessionB,
    );
    await call(
      'Other user survives foreign deletion proof',
      '/api/auth/me',
      200,
      undefined,
      sessionB,
    );
    await call(
      'Synthetic account deletion journal',
      '/api/user/account/delete',
      202,
      { confirmation: 'DELETE', idToken: await getIdToken(b.user, true) },
      sessionB,
    );
    await call('Deleted account session denied', '/api/auth/me', 401, undefined, sessionB);
    await writeFile(
      out + '/integration.json',
      JSON.stringify(
        {
          passed: true,
          records,
          ...(nativeBoundary
            ? { gatewayRequests: f.calls, nativeBatches: f.batches }
            : { restRequests: f.calls, restBatches: f.batches }),
          firebaseKeyFetches: firebase.keyFetches,
          firebaseLiveLookups: firebase.lookups,
          providerMode: 'synthetic intercepted SDK; no live Firebase project',
          databaseTransport: nativeBoundary
            ? 'signed Web to private API service binding; actual workerd native D1'
            : 'local REST fixture',
          browserExternalRequestsBlocked: blocked,
          rssBytes: process.memoryUsage().rss,
        },
        null,
        2,
      ) + '\n',
    );
  } finally {
    if (browser) await browser.close();
    if (edgeServer) await close(edgeServer);
    if (nodeServer) await close(nodeServer);
    if (providerServer) await close(providerServer);
    if (app) await app.close();
    await deleteApp(fixtureApp);
    globalThis.fetch = originalFetch;
    for (const k of Object.keys(process.env)) if (!(k in savedEnv)) delete process.env[k];
    Object.assign(process.env, savedEnv);
    await f.close();
  }
}
void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
