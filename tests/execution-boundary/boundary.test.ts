import test from 'node:test';
import assert from 'node:assert/strict';
import { nativeFixture, configuration, publicOrigin } from './fixture';
import { createWorkerBindings, NativeBoundaryError } from '../../src/server/node-staging/d1-worker';
import { writeFencedDatabase, StorageMaintenanceError } from '../../packages/storage/write-fence';
import { signOriginRequest, ORIGIN_HEADER } from '../../packages/security/origin-assertion';
import { TRANSACTION_PATH } from '../../packages/security/transaction-boundary';

test(
  'actual workerd native gateway: rollback, concurrent CAS, ownership,50-statement batch and stale write fence',
  { timeout: 180000 },
  async () => {
    const f = await nativeFixture();
    try {
      const db = f.bindings.D1_USERS;
      const blob = new Uint8Array(48000).fill(255);
      const returned = await db.prepare('SELECT ? AS value').bind(blob).first<any>();
      assert.deepEqual(returned?.value, Array.from(blob));
      await f.h.db.D1_USERS.prepare(
        'CREATE TABLE boundary_test(id TEXT PRIMARY KEY,n INTEGER NOT NULL)',
      ).run();
      await db.prepare('INSERT INTO boundary_test VALUES(?,?)').bind('counter', 0).run();
      await assert.rejects(
        db.batch([
          db.prepare('INSERT INTO boundary_test VALUES(?,?)').bind('rollback', 1),
          db.prepare('INSERT INTO boundary_test VALUES(?,?)').bind('counter', 1),
        ]),
      );
      assert.equal(
        await db.prepare("SELECT * FROM boundary_test WHERE id='rollback'").first(),
        null,
      );
      const cas = (id: string) =>
        db.batch([
          db.prepare("UPDATE boundary_test SET n=n+1 WHERE id='counter' AND n=0"),
          db.prepare('INSERT INTO app_assertions(nonce,ok) VALUES(?,changes())').bind('cas-' + id),
          db.prepare('INSERT INTO boundary_test VALUES(?,?)').bind('winner-' + id, 1),
        ]);
      const races = await Promise.allSettled([cas('a'), cas('b')]);
      assert.equal(races.filter((x) => x.status === 'fulfilled').length, 1);
      assert.equal(
        (await db.prepare("SELECT n FROM boundary_test WHERE id='counter'").first<any>())?.n,
        1,
      );
      assert.equal(
        (
          await db
            .prepare("SELECT count(*) AS n FROM boundary_test WHERE id LIKE 'winner-%'")
            .first<any>()
        )?.n,
        1,
      );
      await db.batch(
        Array.from({ length: 50 }, (_, i) =>
          db.prepare('INSERT INTO boundary_test VALUES(?,?)').bind('batch-' + i, i),
        ),
      );
      assert((await db.prepare('PRAGMA table_info(boundary_test)').all()).results.length > 0);
      await db
        .prepare(
          'WITH incoming(id,n) AS(VALUES(?,?)) INSERT INTO boundary_test SELECT id,n FROM incoming',
        )
        .bind('cte', 1)
        .run();
      await assert.rejects(db.batch([f.bindings.D1_SHARED.prepare('SELECT 1')]), /Cross-owner/);
      const fenced = writeFencedDatabase(db);
      await fenced.prepare('SELECT epoch FROM app_storage_epoch').all();
      await f.h.db.D1_USERS.prepare('UPDATE app_storage_epoch SET epoch=epoch+1 WHERE id=1').run();
      await assert.rejects(
        fenced.prepare('INSERT INTO boundary_test VALUES(?,?)').bind('stale', 1).run(),
        StorageMaintenanceError,
      );
      assert.equal(await db.prepare("SELECT * FROM boundary_test WHERE id='stale'").first(), null);
      const preserved = await db.prepare('SELECT count(*) AS n FROM boundary_test').first<any>();
      await f.restart();
      const fresh = createWorkerBindings({ configuration, request: f.dispatch });
      assert.deepEqual(
        await fresh.D1_USERS.prepare('SELECT count(*) AS n FROM boundary_test').first(),
        preserved,
      );
      let attempts = 0;
      const ambiguous = createWorkerBindings({
        configuration,
        request: async () => {
          attempts++;
          throw Error('Timeout after possible commit');
        },
      });
      await assert.rejects(ambiguous.D1_USERS.prepare('SELECT 1').all(), NativeBoundaryError);
      assert.equal(attempts, 1);
    } finally {
      await f.close();
    }
  },
);

test(
  'actual workerd gateway: no browser SQL capability; missing, forged, expired, replayed and reflected origin assertions denied',
  { timeout: 180000 },
  async () => {
    const f = await nativeFixture();
    try {
      const url = publicOrigin + TRANSACTION_PATH;
      const body = JSON.stringify({
        owner: 'D1_USERS',
        batch: false,
        queries: [{ sql: 'SELECT 1 AS n', params: [] }],
      });
      const source = () =>
        new Request(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body });
      const send = async (secret = configuration, now?: number) => {
        const s = await signOriginRequest(source(), secret, now);
        return new Request(url, {
          method: 'POST',
          headers: { [ORIGIN_HEADER]: s.assertion },
          body: s.body as BodyInit,
        });
      };
      assert.equal((await f.dispatch(source())).status, 403);
      const form = await f.dispatch(publicOrigin + '/__staging/access');
      assert.equal(form.status, 200);
      assert.equal(form.headers.get('referrer-policy'), 'same-origin');
      for (const origin of ['null', 'https://untrusted.example']) {
        const denied = await f.dispatch(publicOrigin + '/__staging/access', {
          method: 'POST',
          headers: { origin, 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            credential: 'synthetic-boundary-browser-gate-secret-independent-64-characters-only',
          }),
        });
        assert.equal(denied.status, 403);
      }
      const gate = await f.dispatch(publicOrigin + '/__staging/access', {
        method: 'POST',
        redirect: 'manual',
        headers: {
          origin: publicOrigin,
          'content-type': 'application/x-www-form-urlencoded',
          'cf-connecting-ip': '127.0.0.1',
        },
        body: new URLSearchParams({
          credential: 'synthetic-boundary-browser-gate-secret-independent-64-characters-only',
        }),
      });
      assert.equal(gate.status, 303);
      const cookie = gate.headers.get('set-cookie')!.split(';')[0];
      assert.equal(
        (
          await f.dispatch(url, {
            method: 'POST',
            headers: { cookie },
            body: JSON.stringify({
              owner: 'D1_USERS',
              batch: false,
              queries: [{ sql: 'DELETE FROM app_storage_epoch', params: [] }],
            }),
          })
        ).status,
        403,
      );
      assert.equal(
        (await f.h.db.D1_USERS.prepare('SELECT count(*) AS n FROM app_storage_epoch').first<any>())
          ?.n,
        1,
      );

      assert.equal(
        (
          await f.dispatch(
            new Request(url, {
              method: 'POST',
              headers: { cookie: '__Host-dd_staging=forged', 'x-dd-user': 'owner' },
              body,
            }),
          )
        ).status,
        403,
      );
      const valid = await send(),
        copy = valid.clone();
      assert.equal((await f.dispatch(valid)).status, 200);
      await f.restart();
      assert.equal((await f.dispatch(copy)).status, 403);
      const race = await send();
      const results = await Promise.all([f.dispatch(race.clone()), f.dispatch(race)]);
      assert.equal(results.filter((r) => r.status === 200).length, 1);
      assert.equal(
        (await f.dispatch(await send(configuration, Math.floor(Date.now() / 1000) - 60))).status,
        403,
      );
      assert.equal(
        (
          await f.dispatch(
            await send({
              ...configuration,
              secret: 'synthetic-wrong-secret-64-characters-and-independent-for-tests-only',
            }),
          )
        ).status,
        403,
      );
      assert.equal(
        (await f.dispatch(await send({ ...configuration, audience: 'dd-render-staging' }))).status,
        403,
      );
      const altered = await send();
      assert.equal(
        (
          await f.dispatch(
            new Request(url, {
              method: 'POST',
              headers: altered.headers,
              body: body.replace('SELECT 1', 'DELETE FROM app_users'),
            }),
          )
        ).status,
        403,
      );
      // Signed transport authorizes only a single logical owner; raw DB IDs and SQL
      // scripts/schema-changing commands are not a public/admin endpoint.
      const ddl = new Request(url, {
        method: 'POST',
        body: JSON.stringify({
          owner: 'D1_USERS',
          batch: false,
          queries: [{ sql: 'DROP TABLE app_users', params: [] }],
        }),
      });
      const signed = await signOriginRequest(ddl, configuration);
      assert.equal(
        (
          await f.dispatch(url, {
            method: 'POST',
            headers: { [ORIGIN_HEADER]: signed.assertion },
            body: signed.body as BodyInit,
          })
        ).status,
        409,
      );
      await f.h.db.D1_USERS.prepare('UPDATE app_storage_epoch SET locked=1 WHERE id=1').run();
      assert.equal((await f.dispatch(await send())).status, 403);
    } finally {
      await f.close();
    }
  },
);

test('coordinated origin/transaction key rotation rejects old and cross-audience assertions before nonce access', async () => {
  const { verifyOriginRequest } = await import('../../packages/security/origin-assertion');
  for (const audience of ['dd-render-staging', configuration.audience]) {
    const before = { ...configuration, audience },
      after = {
        ...before,
        secret: 'synthetic-replacement-key-64-characters-independent-for-rotation-only',
      };
    const source = new Request(publicOrigin + '/api/auth/me');
    const signed = async (key: typeof before) => {
      const s = await signOriginRequest(source, key);
      return new Request(source.url, { headers: { [ORIGIN_HEADER]: s.assertion } });
    };
    let claims = 0;
    const claim = async () => {
      claims++;
    };
    await verifyOriginRequest(await signed(before), before, claim);
    await assert.rejects(verifyOriginRequest(await signed(before), after, claim));
    await verifyOriginRequest(await signed(after), after, claim);
    await assert.rejects(verifyOriginRequest(await signed(after), before, claim));
    await assert.rejects(
      verifyOriginRequest(await signed(after), { ...after, audience: 'wrong-audience' }, claim),
    );
    assert.equal(claims, 2);
  }
});
