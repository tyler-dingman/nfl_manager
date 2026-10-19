import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { harness } from '../test/harness';
import { Storage, objectKey, type SqlDatabase } from '../../../packages/storage/core';
import { D1Objects } from '../../../packages/storage/d1-objects';
import {
  collectPayloadGarbage,
  storageCapacity,
} from '../../../packages/storage/garbage-collection';
import { D1OddsBoard } from '../../../packages/storage/odds-board';
import { PrecomputedProps } from '../../../packages/storage/parlay-scores';
import { expireSupersededScores } from '../../../packages/storage/derived-retention';
const ack = 'OWNER_MAINTENANCE_RAW_WRITERS_STOPPED' as const;
test(
  'private bounded workerd sweep resumes after restart, fences writers and handles concurrent steps',
  { timeout: 120000 },
  async () => {
    const script = (
      await build({
        stdin: {
          contents: `import {maintenanceStep} from '../../packages/storage/maintenance-step';import {instrumentDatabase,requestMetrics} from '../../packages/storage/instrumentation';export default {async fetch(r,e){if(r.headers.get('authorization')!=='Bearer synthetic-owner-only')return new Response(null,{status:401});const m=requestMetrics();const result=await maintenanceStep(instrumentDatabase(e.EDITORIAL_DB,m),await r.text(),'OWNER_PRIVATE_MAINTENANCE');return Response.json({result,metrics:m});}}`,
          resolveDir: process.cwd(),
        },
        bundle: true,
        format: 'esm',
        platform: 'browser',
        write: false,
      })
    ).outputFiles[0].text;
    const h = await harness(true, true, 999, script, false);
    try {
      let db = h.binding as unknown as SqlDatabase;
      const s = new Storage(db, new D1Objects(db));
      const pinned = await s.put({ original: 'saved betting evidence' });
      await s
        .statement('INSERT INTO app_storage_pins(hash,reason) VALUES(?,?)', [
          pinned,
          'recovery and saved evidence',
        ])
        .run();
      for (let i = 0; i < 4; i++) await s.put({ orphan: i });
      const plan = await collectPayloadGarbage(db, {
        dryRun: false,
        prepareOnly: true,
        limit: 500,
        acknowledge: ack,
      });
      assert.equal((await h.mf.dispatchFetch('http://private.test/')).status, 401);
      await assert.rejects(new Storage(db, new D1Objects(db)).put({ blocked: true }));
      const step = async () => {
        const response = await h.mf.dispatchFetch('http://private.test/', {
          method: 'POST',
          headers: { authorization: 'Bearer synthetic-owner-only' },
          body: plan.runId,
        });
        assert.equal(response.status, 200);
        const body = (await response.json()) as any;
        assert(body.metrics.statements <= 12, JSON.stringify(body));
        return body.result;
      };
      await step();
      db = (await h.restart()) as unknown as SqlDatabase;
      await Promise.all([step(), step()]);
      for (let i = 0; i < 8; i++) if ((await step()).done) break;
      assert.equal((await step()).deleted, 0);
      assert.equal((await storageCapacity(db)).objects, 1);
      assert(await new D1Objects(db).get(objectKey(pinned)));
      assert.equal(
        (await db.prepare('SELECT count(*) AS n FROM app_storage_gc_audit').first<any>()).n,
        4,
      );
      assert.equal(
        (await db.prepare('SELECT locked FROM app_storage_epoch').first<any>()).locked,
        0,
      );
    } finally {
      await h.close();
    }
  },
);
test(
  'source-version retention removes only unreadable score cache rows and preserves saved evidence and old odds IDs',
  { timeout: 120000 },
  async () => {
    const h = await harness(false, true, 999, undefined, false);
    try {
      const db = h.binding as unknown as SqlDatabase,
        s = new Storage(db, new D1Objects(db)),
        board = new D1OddsBoard(s),
        scores = new PrecomputedProps(s);
      const event = {
        providerEventId: 'original-event',
        season: 2026,
        week: 1,
        homeTeamId: 'KC',
        awayTeamId: 'SEA',
        kickoffAt: new Date(Date.now() + 86400000),
        status: 'SCHEDULED',
      };
      const market = {
        id: 'original-market',
        normalizedKey: 'original-key',
        playerId: 'original-player',
        marketType: 'PASS_YARDS',
        side: 'OVER',
        sportsbook: 'original-book',
        period: 'game',
        isAltLine: false,
        available: true,
        line: 250.5,
        odds: -110,
      };
      const id = await board.publish(event, [market], Date.now() - 10000, 'original-event-id');
      const oldSource = await scores.sources(id),
        hash = await scores.publish(id, 'original-model', {}, 2026, undefined, oldSource, [
          { id: market.id, score: 80 },
        ]);
      await s
        .statement('INSERT INTO app_storage_pins(hash,reason) VALUES(?,?)', [
          hash,
          'saved betting evidence',
        ])
        .run();
      await board.publish(event, [{ ...market, line: 251.5 }], Date.now());
      assert.equal(await scores.read(id, 'original-model', {}, 2026), null);
      assert.equal((await expireSupersededScores(s)).removed, 1);
      const source = await scores.sources(id);
      await scores.publish(id, 'original-model', {}, 2026, undefined, source, [
        { id: market.id, score: 81 },
      ]);
      assert.equal((await expireSupersededScores(s)).removed, 0);
      const history = await board.priceHistory(id, new Date(Date.now() + 1000).toISOString());
      assert.equal(history.length, 2);
      assert(history.every((m) => m.marketId === market.id));
      await collectPayloadGarbage(db, { dryRun: false, limit: 500, acknowledge: ack });
      const fresh = new Storage(db, new D1Objects(db));
      assert.equal((await fresh.get<any>(hash)).rows[0].score, 80);
      assert.equal(
        (await new D1OddsBoard(fresh).priceHistory(id, new Date(Date.now() + 1000).toISOString()))
          .length,
        2,
      );
    } finally {
      await h.close();
    }
  },
);

test(
  'inline bulk retrieval bounds statements and still rejects corrupt bytes',
  { timeout: 120000 },
  async () => {
    const h = await harness(false, true, 999, undefined, false);
    try {
      const db = h.binding as unknown as SqlDatabase,
        s = new Storage(db, new D1Objects(db));
      const hashes = [];
      for (let i = 0; i < 100; i++) hashes.push(await s.put({ id: i, text: 'source attribution' }));
      const { instrumentDatabase, requestMetrics } =
        await import('../../../packages/storage/instrumentation');
      const metrics = requestMetrics(),
        objects = new D1Objects(instrumentDatabase(db, metrics));
      await objects.prefetch(hashes.map(objectKey));
      for (const hash of hashes) assert(await objects.get(objectKey(hash)));
      assert(metrics.statements <= 5, JSON.stringify(metrics));
      await db
        .prepare('UPDATE app_payload_objects SET inline_data=zeroblob(bytes) WHERE hash=?')
        .bind(hashes[0])
        .run();
      const fresh = new D1Objects(db);
      await fresh.prefetch([objectKey(hashes[0])]);
      await assert.rejects(fresh.get(objectKey(hashes[0])));
      const { repackLegacyPayload } = await import('../../../packages/storage/repack');
      await repackLegacyPayload(db, hashes[1], ack, 'base64');
      await db
        .prepare('UPDATE app_payload_objects SET complete=0 WHERE hash=?')
        .bind(hashes[1])
        .run();
      const resumed = new D1Objects(db);
      await resumed.putImmutable(
        objectKey(hashes[1]),
        new TextEncoder().encode(JSON.stringify({ id: 1, text: 'source attribution' })),
      );
      assert(await resumed.get(objectKey(hashes[1])));
    } finally {
      await h.close();
    }
  },
);
test(
  'consumed-token archival and stale-score maintenance preserve rows within one bounded invocation',
  { timeout: 120000 },
  async () => {
    const h = await harness(false, true, 999, undefined, false);
    try {
      const db = h.binding as unknown as SqlDatabase;
      await db
        .prepare(
          "INSERT INTO app_users(id,primary_email,status,created_at,updated_at) VALUES('maintenance-owner','maintenance@example.invalid','ACTIVE',1,1)",
        )
        .run();
      for (let i = 0; i < 15; i++)
        await db
          .prepare(
            "INSERT INTO app_tokens(id,user_id,type,token_hash,expires_at,consumed_at) VALUES(?,'maintenance-owner','PASSWORD_RESET',?,1,1)",
          )
          .bind('token-' + i, 'hash-' + i)
          .run();
      const { instrumentDatabase, requestMetrics } =
        await import('../../../packages/storage/instrumentation');
      const { maintainTemporaryData } = await import('../../../packages/storage/lifecycle');
      const metrics = requestMetrics(),
        observed = instrumentDatabase(db, metrics),
        s = new Storage(observed, new D1Objects(observed));
      const result = await maintainTemporaryData(s);
      assert.equal(result.archivedConsumedTokens, 15);
      assert(metrics.statements < 30, JSON.stringify(metrics));
      const pack = await db.prepare('SELECT object_hash FROM app_history_packs').first<any>();
      assert.equal((await s.get<any>(pack.object_hash)).rows.length, 15);
    } finally {
      await h.close();
    }
  },
);
