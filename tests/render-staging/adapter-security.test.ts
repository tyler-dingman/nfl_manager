import test from 'node:test';
import assert from 'node:assert/strict';
import { restFixture } from './fixture';
import {
  createRestBindings,
  RestAtomicityUnverified,
  D1RestError,
} from '../../src/server/node-staging/d1-rest';
import { writeFencedDatabase, StorageMaintenanceError } from '../../packages/storage/write-fence';
import {
  signOriginRequest,
  verifyOriginRequest,
  ORIGIN_HEADER,
} from '../../packages/security/origin-assertion';
import { claimOriginNonce } from '../../src/server/node-staging/replay';
const configuration = {
  secret: 'synthetic-origin-secret-independent-from-app-secret-64-characters-only',
  audience: 'dd-render-staging',
  publicOrigin: 'https://local-render.workers.dev',
};
test('REST binding preserves batch rollback, bound blobs, ownership, fences and ambiguous-outcome no-retry', async () => {
  const f = await restFixture();
  try {
    const db = f.bindings.D1_USERS;
    await db.prepare('CREATE TABLE fixture(id TEXT PRIMARY KEY,value BLOB)').run();
    const before = f.calls;
    await db.batch([
      db
        .prepare('INSERT INTO fixture VALUES(?,?)')
        .bind("quoted'; value", new Uint8Array([0, 255, 1])),
      db.prepare('INSERT INTO fixture VALUES(?,?)').bind('other', null),
    ]);
    assert.equal(f.calls, before + 1);
    assert.deepEqual(
      (await db.prepare('SELECT value FROM fixture WHERE id=?').bind("quoted'; value").first<any>())
        ?.value,
      [0, 255, 1],
    );
    await assert.rejects(
      db.batch([
        db.prepare('INSERT INTO fixture VALUES(?,?)').bind('rollback', null),
        db.prepare('INSERT INTO fixture VALUES(?,?)').bind('other', null),
      ]),
    );
    assert.equal(
      await db.prepare('SELECT * FROM fixture WHERE id=?').bind('rollback').first(),
      null,
    );
    await assert.rejects(db.batch([f.bindings.D1_SHARED.prepare('SELECT 1')]), /Cross-database/);
    const fenced = writeFencedDatabase(db);
    await fenced.prepare('SELECT epoch FROM app_storage_epoch').all();
    await db.prepare('UPDATE app_storage_epoch SET epoch=epoch+1 WHERE id=1').run();
    await assert.rejects(
      fenced.prepare('INSERT INTO fixture VALUES(?,?)').bind('stale', null).run(),
      StorageMaintenanceError,
    );
    assert.equal(await db.prepare("SELECT * FROM fixture WHERE id='stale'").first(), null);
    const unknown = createRestBindings({ ...f.options, localAtomicFixture: false });
    assert.throws(() => unknown.D1_USERS.prepare('SELECT 1; DELETE FROM fixture'), /Exactly one/);
    assert.equal((await unknown.D1_USERS.prepare("SELECT ';' AS value").first<any>())?.value, ';');
    const mutable = { ...f.options, databaseIds: { ...f.options.databaseIds } };
    const immutable = createRestBindings(mutable);
    mutable.endpoint = 'https://untrusted.invalid';
    mutable.databaseIds.D1_USERS = mutable.databaseIds.D1_SHARED;
    assert.equal(
      (await immutable.D1_USERS.prepare('SELECT count(*) AS n FROM fixture').first<any>())?.n,
      2,
    );
    const calls = f.calls;
    await assert.rejects(
      unknown.D1_USERS.batch([unknown.D1_USERS.prepare('SELECT 1')]),
      RestAtomicityUnverified,
    );
    await assert.rejects(
      unknown.D1_USERS.prepare('DELETE FROM fixture').run(),
      RestAtomicityUnverified,
    );
    assert.equal(f.calls, calls);
    let attempts = 0;
    const ambiguous = createRestBindings({
      ...f.options,
      request: async () => {
        attempts++;
        throw Error('Synthetic timeout after commit');
      },
    });
    await assert.rejects(ambiguous.D1_USERS.prepare('SELECT 1').all(), D1RestError);
    assert.equal(attempts, 1);
    assert.throws(
      () => createRestBindings({ ...f.options, endpoint: 'https://api.cloudflare.com/client/v4' }),
      /Local atomic/,
    );
  } finally {
    await f.close();
  }
});
test('origin assertions reject missing, forged, expired, replayed and modified requests; durable cross-instance claim', async () => {
  const f = await restFixture();
  try {
    const source = new Request(configuration.publicOrigin + '/api/auth/firebase/session?q=1', {
      method: 'POST',
      headers: {
        cookie: 'synthetic-cookie',
        'content-type': 'application/json',
        'x-forwarded-for': 'spoofed',
        'x-dd-user': 'spoofed',
      },
      body: '{"synthetic":true}',
    });
    const make = async (now?: number) => {
      const s = await signOriginRequest(source, configuration, now);
      return new Request('http://127.0.0.1/api/auth/firebase/session?q=1', {
        method: 'POST',
        headers: {
          [ORIGIN_HEADER]: s.assertion,
          'x-forwarded-for': 'untrusted',
          cookie: 'attacker',
        },
        body: s.body as BodyInit,
      });
    };
    const claim = (n: string, e: number) => claimOriginNonce(f.bindings.D1_USERS, n, e);
    await assert.rejects(
      verifyOriginRequest(new Request('http://127.0.0.1/api/auth/me'), configuration, claim),
    );
    const forged = await make();
    forged.headers.set(ORIGIN_HEADER, forged.headers.get(ORIGIN_HEADER)!.slice(0, -3) + 'aaa');
    await assert.rejects(verifyOriginRequest(forged, configuration, claim));
    await assert.rejects(
      verifyOriginRequest(await make(Math.floor(Date.now() / 1000) - 60), configuration, claim),
    );
    const valid = await make(),
      copy = valid.clone(),
      result = await verifyOriginRequest(valid, configuration, claim);
    assert.equal(result.headers.get('cookie'), 'synthetic-cookie');
    assert.equal(result.headers.get('x-forwarded-for'), null);
    assert.equal(result.headers.get('x-dd-user'), null);
    assert.equal(await result.text(), '{"synthetic":true}');
    const freshBindings = createRestBindings(f.options);
    await assert.rejects(
      verifyOriginRequest(copy, configuration, (n, e) =>
        claimOriginNonce(freshBindings.D1_USERS, n, e),
      ),
    );
    const altered = await make();
    await assert.rejects(
      verifyOriginRequest(
        new Request(altered.url, { method: 'POST', headers: altered.headers, body: 'tampered' }),
        configuration,
        claim,
      ),
    );
    const path = await make();
    await assert.rejects(
      verifyOriginRequest(
        new Request('http://127.0.0.1/api/auth/logout', {
          method: 'POST',
          headers: path.headers,
          body: await path.arrayBuffer(),
        }),
        configuration,
        claim,
      ),
    );
    const racing = await make();
    const race = await Promise.allSettled([
      verifyOriginRequest(racing.clone(), configuration, claim),
      verifyOriginRequest(racing, configuration, claim),
    ]);
    assert.equal(race.filter((x) => x.status === 'fulfilled').length, 1);
    await f.bindings.D1_USERS.prepare('UPDATE app_storage_epoch SET locked=1 WHERE id=1').run();
    await assert.rejects(verifyOriginRequest(await make(), configuration, claim));
  } finally {
    await f.close();
  }
});
