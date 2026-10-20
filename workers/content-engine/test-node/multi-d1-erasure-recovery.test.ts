import { sealErasureLedger } from '../../../scripts/erasure-ledger';
import test from 'node:test';
import assert from 'node:assert/strict';
import { multiHarness, splitSql } from '../test/multi-harness';
import { MultiD1 } from '../../../packages/storage/multi-d1';
import {
  requestMultiD1Erasure,
  continueMultiD1Erasure,
} from '../../../packages/storage/account-erasure-multi';
import { verifyCrossShardReferences } from '../../../packages/storage/cross-shard-saves';
import { backupDatabases, restoreDatabases } from '../../../scripts/multi-d1-recovery';
test(
  'coordinated restore preserves an interrupted erasure and its mutation guards',
  { timeout: 120000 },
  async () => {
    const source = await multiHarness(),
      target = await multiHarness(false);
    try {
      await source.db.D1_USERS.prepare(
        "INSERT INTO app_users(id,status,primary_email,created_at,updated_at) VALUES('erasing','ACTIVE','synthetic@test.invalid',1,1)",
      ).run();
      await requestMultiD1Erasure(new MultiD1(source.db).users(), 'erasing', 'a'.repeat(64));
      await continueMultiD1Erasure(new MultiD1(source.db).users());
      const before = await source.db.D1_USERS.prepare(
        "SELECT cursor,status FROM app_account_erasure WHERE user_id='erasing'",
      ).first();
      const secret = 'synthetic-rc2-erasure-backup-key-32-characters';
      const archive = await backupDatabases(source.db, secret, {
        rawWritersStopped: true,
        verifyReferences: verifyCrossShardReferences,
      });
      await restoreDatabases(archive, secret, target.db, {
        currentErasureLedger: await sealErasureLedger(source.db.D1_USERS, secret),
        isolatedEmptyTargets: true,
        verifyReferences: verifyCrossShardReferences,
        execute: async (owner, sql) => {
          for (const statement of splitSql(sql)) await target.db[owner].prepare(statement).run();
        },
      });
      await target.restart();
      assert.deepEqual(
        await target.db.D1_USERS.prepare(
          "SELECT cursor,status FROM app_account_erasure WHERE user_id='erasing'",
        ).first(),
        before,
      );
      assert.equal(
        (
          await target.db.D1_USERS.prepare(
            "SELECT status FROM app_users WHERE id='erasing'",
          ).first<any>()
        )?.status,
        'DELETED',
      );
      await assert.rejects(
        target.db.D1_USERS.prepare(
          "INSERT INTO app_settings(user_id,updated_at) VALUES('erasing',1)",
        ).run(),
        /erasure/,
      );
      const router = new MultiD1(target.db);
      await continueMultiD1Erasure(router.users());
      assert.ok(router.metrics.statements < 30);
    } finally {
      await source.close();
      await target.close();
    }
  },
);
