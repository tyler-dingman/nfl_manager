import test from 'node:test';
import assert from 'node:assert/strict';
import { restFixture } from './fixture';
import { seedStories } from './product-fixtures';
import { MultiD1 } from '../../packages/storage/multi-d1';
import { D1AuthRepository } from '../../packages/storage/auth';
import { D1UserWorkflows } from '../../packages/storage/user-workflows';
import {
  saveCrossShardContent,
  verifyCrossShardReferences,
} from '../../packages/storage/cross-shard-saves';
import { backupDatabases, restoreDatabases } from '../../scripts/multi-d1-recovery';
import { sealErasureLedger } from '../../scripts/erasure-ledger';
import { splitSql } from '../../packages/storage/sql-script';
test(
  'REST cross-shard identities, saved synthetic bets and isolated coordinated recovery retain original IDs',
  { timeout: 180000 },
  async () => {
    const f = await restFixture(),
      target = await restFixture(false);
    try {
      await seedStories(f.bindings);
      const users = new D1AuthRepository(new MultiD1(f.bindings).users()),
        a = await users.createEmailUser({
          email: 'rest-owner@example.invalid',
          passwordHash: 'isolated-preserved-credential',
        }),
        b = await new D1AuthRepository(new MultiD1(f.bindings).users()).createEmailUser({
          email: 'rest-other@example.invalid',
          passwordHash: 'isolated-preserved-credential',
        });
      assert(a && b);
      for (const team of ['KC', 'BUF', 'NFL'])
        await saveCrossShardContent(new MultiD1(f.bindings), a.id, {
          contentType: 'STORY',
          contentId: 'render-fixture-' + team,
          title: 'Synthetic',
          metadata: { owner: 'D1_TEAM_8' },
        });
      await saveCrossShardContent(new MultiD1(f.bindings), a.id, {
        contentType: 'OTHER',
        contentId: 'synthetic-parlay',
        title: 'Synthetic only',
        metadata: {
          kind: 'PARLAY',
          play: {
            selections: [
              { eventId: 'synthetic-event', selection: 'KC', market: 'MONEYLINE', odds: -110 },
            ],
          },
        },
      });
      assert.equal(
        (await new D1UserWorkflows(new MultiD1(f.bindings).users()).listSavedContent(a.id)).length,
        4,
      );
      assert.equal(
        (await new D1UserWorkflows(new MultiD1(f.bindings).users()).listSavedContent(b.id)).length,
        0,
      );
      await verifyCrossShardReferences(f.bindings);
      const secret = 'synthetic-offline-recovery-key-at-least-64-characters-only';
      const archive = await backupDatabases(f.bindings, secret, {
        rawWritersStopped: true,
        verifyReferences: verifyCrossShardReferences,
      });
      const ledger = await sealErasureLedger(f.bindings.D1_USERS, secret);
      await restoreDatabases(archive, secret, target.bindings, {
        currentErasureLedger: ledger,
        isolatedEmptyTargets: true,
        execute: async (owner, sql) => {
          for (const statement of splitSql(sql))
            await target.bindings[owner].prepare(statement).run();
        },
        verifyReferences: verifyCrossShardReferences,
      });
      await verifyCrossShardReferences(target.bindings);
      assert.equal(
        (await new D1UserWorkflows(new MultiD1(target.bindings).users()).listSavedContent(a.id))
          .length,
        4,
      );
      const corrupt = structuredClone(archive) as any;
      corrupt.manifest.windowId = 'corrupt';
      await assert.rejects(
        restoreDatabases(corrupt, secret, target.bindings, {
          currentErasureLedger: ledger,
          isolatedEmptyTargets: true,
          execute: async () => {
            throw Error('Must not mutate');
          },
          verifyReferences: verifyCrossShardReferences,
        }),
      );
    } finally {
      await target.close();
      await f.close();
    }
  },
);
