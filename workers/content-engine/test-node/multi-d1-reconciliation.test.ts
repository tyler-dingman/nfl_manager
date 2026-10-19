import test from 'node:test';
import assert from 'node:assert/strict';
import { multiHarness } from '../test/multi-harness';
import { DATABASE_OWNERS } from '../../../packages/storage/multi-d1';
import { reconcileMultiD1References } from '../../../packages/storage/reconcile-multi-d1';
test(
  'offline reconciliation preserves other users, pending saves, permanent bets and non-owned pins',
  { timeout: 120000 },
  async () => {
    const h = await multiHarness();
    try {
      await assert.rejects(reconcileMultiD1References(h.db, Date.now()), /lock/);
      for (const owner of DATABASE_OWNERS)
        await h.db[owner]
          .prepare(
            'INSERT INTO app_storage_epoch(id,epoch,locked) VALUES(1,1,1) ON CONFLICT(id) DO UPDATE SET locked=1',
          )
          .run();
      const users = h.db.D1_USERS,
        target = h.db.D1_TEAM_1;
      for (const user of ['u1', 'u2'])
        await users
          .prepare("INSERT INTO app_users(id,status,created_at,updated_at) VALUES(?,'ACTIVE',1,1)")
          .bind(user)
          .run();
      const now = Date.now();
      for (const [i, user, saved, age] of [
        [1, 'u1', false, 2],
        [2, 'u2', true, 2],
        [3, 'u1', false, 0],
      ] as const) {
        const hash = String(i).repeat(64);
        await target
          .prepare("INSERT INTO app_storage_pins(hash,reason) VALUES(?,'multi-d1-reference')")
          .bind(hash)
          .run();
        await users
          .prepare(
            "INSERT INTO app_cross_shard_references(user_id,kind,content_id,owner,object_hash,state,updated_at) VALUES(?,'STORY',?,'D1_TEAM_1',?,'COMMITTED',?)",
          )
          .bind(user, 'story' + i, hash, now - age * 86400000)
          .run();
        if (saved)
          await users
            .prepare(
              "INSERT INTO app_saved_content(id,user_id,content_type,content_id,title,metadata_json,created_at) VALUES('saved',?,'STORY',?,'title','{}',1)",
            )
            .bind(user, 'story' + i)
            .run();
      }
      await target
        .prepare("INSERT INTO app_storage_pins(hash,reason) VALUES(?,'operator-legal-hold')")
        .bind('4'.repeat(64))
        .run();
      await h.db.D1_SHARED.prepare(
        "INSERT INTO app_storage_pins(hash,reason) VALUES(?,'multi-d1-saved-bet')",
      )
        .bind('5'.repeat(64))
        .run();
      await users
        .prepare(
          "INSERT INTO app_saved_bet_receipts(user_id,content_id,boards_json,created_at) VALUES('u1','permanent',?,1)",
        )
        .bind(JSON.stringify(['5'.repeat(64)]))
        .run();
      const r = await reconcileMultiD1References(h.db, now);
      assert.equal(r.retiredEditorialReferences, 1);
      assert.equal(r.removedPins, 1);
      assert.equal(
        (await target.prepare('SELECT count(*) n FROM app_storage_pins').first<any>())?.n,
        3,
      );
      assert.equal(
        (await users.prepare('SELECT count(*) n FROM app_saved_bet_receipts').first<any>())?.n,
        1,
      );
      assert.equal((await reconcileMultiD1References(h.db, now)).removedPins, 0);
    } finally {
      await h.close();
    }
  },
);
