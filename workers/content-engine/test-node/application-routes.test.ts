import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { harness } from '../test/harness';
import { Storage, type SqlDatabase } from '../../../packages/storage/core';
import { PrivateObjects, type Bucket } from '../../../packages/storage/objects';
import { unseal } from '../../../packages/storage/mail';
import {
  withApplicationBindings,
  type ApplicationBindings,
} from '../../../src/server/persistence/bindings';
import { POST as signup } from '../../../src/app/api/auth/signup/route';
import { POST as login } from '../../../src/app/api/auth/login/route';
import { POST as logout } from '../../../src/app/api/auth/logout/route';
import { POST as forgot } from '../../../src/app/api/auth/forgot-password/route';
import { POST as reset } from '../../../src/app/api/auth/reset-password/route';
import { POST as verify } from '../../../src/app/api/auth/verify-email/route';
import { GET as me } from '../../../src/app/api/auth/me/route';
import {
  GET as preferences,
  PATCH as changePreferences,
} from '../../../src/app/api/user/preferences/route';
import {
  GET as subscriptions,
  PATCH as subscribe,
} from '../../../src/app/api/user/email-subscriptions/route';
import { POST as search } from '../../../src/app/api/search/route';
import { authDb } from '../../../src/server/auth/database';
import { GET as saved, POST as save } from '../../../src/app/api/user/saved-content/route';
import { accountParlays, saveAccountParlay } from '../../../packages/parlay/account-saves';
import { requestMetrics, instrumentDatabase } from '../../../packages/storage/instrumentation';
import { writeFile } from 'node:fs/promises';
test('real Next handlers on D1: email recovery, login/logout, native bearer session, preferences and restart', async () => {
  const h = await harness(true);
  try {
    const secret = 'synthetic-mail-and-auth-key-at-least-32-characters',
      metrics = requestMetrics(),
      bindings: ApplicationBindings = {
        db: instrumentDatabase(h.binding as unknown as SqlDatabase, metrics),
        objects: new PrivateObjects(
          (await h.mf.getR2Bucket('EDITORIAL_ARCHIVE')) as unknown as Bucket,
        ),
        env: {
          APP_DATA_BACKEND: 'd1',
          AUTH_JWT_SECRET: secret,
          AUTH_BASE_URL: 'https://synthetic.example.invalid',
          APP_MAIL_ENCRYPTION_KEY: secret,
          APP_RUNTIME: 'node',
        },
      };
    const s = () => new Storage(bindings.db, bindings.objects),
      measurements: Record<string, unknown>[] = [];
    const invoke = async (
      handler: (r: NextRequest) => Promise<Response>,
      path: string,
      method: string,
      body?: unknown,
      token?: string,
    ) =>
      withApplicationBindings(bindings, async () => {
        const start = performance.now(),
          before = { ...metrics };
        const response = await handler(
          new NextRequest(`https://synthetic.example.invalid${path}`, {
            method,
            headers: {
              'content-type': 'application/json',
              ...(token ? { cookie: `dd_session=${token}` } : {}),
            },
            ...(body ? { body: JSON.stringify(body) } : {}),
          }),
        );
        measurements.push({
          path,
          status: response.status,
          localWallMs: performance.now() - start,
          d1Calls: metrics.d1Calls - before.d1Calls,
          rowsRead: metrics.rowsRead - before.rowsRead,
          rowsWritten: metrics.rowsWritten - before.rowsWritten,
          statements: metrics.statements - before.statements,
          workerCpuMs: null,
        });
        return response;
      });
    await withApplicationBindings(bindings, async () =>
      assert.throws(authDb, /PostgreSQL access forbidden/),
    );
    const created = await invoke(signup, '/api/auth/signup', 'POST', {
      email: 'route@example.invalid',
      password: 'initial-password-fixture',
    });
    assert.equal(created.status, 201, await created.clone().text());
    const user = (await created.json()).user,
      session = created.headers.get('set-cookie')!.match(/dd_session=([^;]+)/)![1];
    assert.equal((await invoke(me, '/api/auth/me', 'GET', undefined, session)).status, 200);
    const [verification] = await s().rows<any>(
        "SELECT object_hash FROM app_mail WHERE purpose='TRANSACTIONAL'",
      ),
      mail = await unseal<any>(await s().get<any>(verification.object_hash), secret),
      link = new URL(mail.text.split(': ').at(-1));
    assert.equal(
      (
        await invoke(verify, '/api/auth/verify-email', 'POST', {
          token: link.searchParams.get('verifyToken'),
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await invoke(
          changePreferences,
          '/api/user/preferences',
          'PATCH',
          { reducedMotion: true, preferredTeamId: 'KC' },
          session,
        )
      ).status,
      200,
    );
    assert.equal((await invoke(preferences, '/api/user/preferences', 'GET')).status, 401);
    assert.equal(
      (
        await invoke(
          subscribe,
          '/api/user/email-subscriptions',
          'PATCH',
          { enabled: true },
          session,
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await (
          await invoke(subscriptions, '/api/user/email-subscriptions', 'GET', undefined, session)
        ).json()
      ).enabled,
      true,
    );
    const native = await invoke(login, '/api/auth/login', 'POST', {
      email: 'route@example.invalid',
      password: 'initial-password-fixture',
      mobile: true,
    });
    assert.equal(native.status, 200);
    const credentials = await native.json();
    assert.equal(
      await withApplicationBindings(bindings, async () => {
        const response = await me(
          new NextRequest('https://synthetic.example.invalid/api/auth/me', {
            headers: { authorization: `Bearer ${credentials.accessToken}` },
          }),
        );
        return response.status;
      }),
      200,
    );
    assert.equal(
      (
        await invoke(forgot, '/api/auth/forgot-password', 'POST', {
          email: 'route@example.invalid',
        })
      ).status,
      200,
    );
    const [resetMail] = await s().rows<any>(
        "SELECT m.object_hash FROM app_mail m WHERE dedupe_key LIKE 'PASSWORD_RESET:%'",
      ),
      message = await unseal<any>(await s().get<any>(resetMail.object_hash), secret),
      resetLink = new URL(message.text.split(': ').at(-1));
    assert.equal(
      (
        await invoke(reset, '/api/auth/reset-password', 'POST', {
          token: resetLink.searchParams.get('resetToken'),
          password: 'replacement-password-fixture',
        })
      ).status,
      200,
    );
    assert.equal((await invoke(me, '/api/auth/me', 'GET', undefined, session)).status, 401);
    assert.equal(
      (
        await invoke(reset, '/api/auth/reset-password', 'POST', {
          token: resetLink.searchParams.get('resetToken'),
          password: 'another-password-fixture',
        })
      ).status,
      400,
    );
    const active = await invoke(login, '/api/auth/login', 'POST', {
      email: 'route@example.invalid',
      password: 'replacement-password-fixture',
    });
    assert.equal(active.status, 200);
    const nextSession = active.headers.get('set-cookie')!.match(/dd_session=([^;]+)/)![1];
    const savedRequest = async (path: string, init?: RequestInit) =>
      invoke(
        init?.method === 'POST' ? save : saved,
        path,
        init?.method ?? 'GET',
        init?.body ? JSON.parse(String(init.body)) : undefined,
        nextSession,
      );
    await saveAccountParlay(savedRequest, {
      id: 'original-saved-slip',
      createdAt: '2026-10-01T00:00:00Z',
      selections: [
        {
          id: 'original-market',
          playerId: 'original-player',
          playerName: 'Synthetic fixture',
          teamId: 'KC',
          marketType: 'PASSING_YARDS',
          side: 'OVER',
          line: 250.5,
          odds: -110,
          sportsbook: 'FANDUEL',
          isAltLine: true,
        },
      ],
    } as any);
    assert.equal((await accountParlays(savedRequest))[0].selections[0].id, 'original-market');
    bindings.db = instrumentDatabase((await h.restart()) as unknown as SqlDatabase, metrics);
    bindings.objects = new PrivateObjects(
      (await h.mf.getR2Bucket('EDITORIAL_ARCHIVE')) as unknown as Bucket,
    );
    assert.equal((await accountParlays(savedRequest))[0].id, 'original-saved-slip');
    assert.equal(
      (
        await (
          await invoke(preferences, '/api/user/preferences', 'GET', undefined, nextSession)
        ).json()
      ).preferences.preferredTeamId,
      'KC',
    );
    assert.equal(
      (
        await invoke(search, '/api/search', 'POST', {
          query: 'Mahomes',
          teamId: 'KC',
          includeAnswer: false,
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await invoke(search, '/api/search', 'POST', {
          query: 'Mahomes',
          teamId: 'KC',
          includeAnswer: true,
        })
      ).status,
      503,
    );
    assert.equal((await invoke(logout, '/api/auth/logout', 'POST', {}, nextSession)).status, 200);
    assert.equal((await invoke(me, '/api/auth/me', 'GET', undefined, nextSession)).status, 401);
    assert.equal((await s().rows('SELECT id FROM app_users'))[0].id, user.id);
    await writeFile(
      '../../reports/zero-cost-phase-3/d1-route-metrics.json',
      JSON.stringify(
        {
          scope:
            'MEASURED Next handler calls on local Miniflare D1/R2. Node wall time; not HTTP bundle isolation or production Worker CPU.',
          measurements,
        },
        null,
        2,
      ),
    );
  } finally {
    await h.close();
  }
});
