import test from 'node:test';
import assert from 'node:assert/strict';
import { multiHarness, splitSql } from '../test/multi-harness';
import { MultiD1, DATABASE_OWNERS } from '../../../packages/storage/multi-d1';
import {
  requestMultiD1Erasure,
  continueMultiD1Erasure,
} from '../../../packages/storage/account-erasure-multi';
import { D1AuthRepository } from '../../../packages/storage/auth';
import { MailQueue } from '../../../packages/storage/mail';
import { maintainMultiD1, resumeMultiD1Maintenance } from '../../../scripts/maintain-multi-d1';
import { backupDatabases, restoreDatabases } from '../../../scripts/multi-d1-recovery';
import { sealErasureLedger } from '../../../scripts/erasure-ledger';
import { verifyCrossShardReferences } from '../../../packages/storage/cross-shard-saves';
import { writeFile, readFile } from 'node:fs/promises';

const secret = 'synthetic-rc3-closure-encrypted-key-at-least-32';
test(
  'erasure survives an older archive, deletes private ciphertext, and preserves populated ten-owner data',
  { timeout: 120000 },
  async () => {
    const h = await multiHarness(),
      target = await multiHarness(false);
    try {
      const r = new MultiD1(h.db);
      const user = (await new D1AuthRepository(r.users()).createEmailUser({
        email: 'erase-secret@example.invalid',
        passwordHash: 'private-phc',
      }))!;
      const keep = (await new D1AuthRepository(r.users()).createEmailUser({
        email: 'keep-secret@example.invalid',
        passwordHash: 'keep-phc',
      }))!;
      await h.db.D1_USERS.prepare(
        'INSERT INTO app_settings(user_id,preferences_json,updated_at) VALUES(?,?,1) ON CONFLICT(user_id) DO UPDATE SET preferences_json=excluded.preferences_json',
      )
        .bind(keep.id, '{"points":42}')
        .run();
      const retained = [];
      for (const owner of DATABASE_OWNERS) {
        const hash = await new MultiD1(h.db).storage(owner).put({ publicFixture: owner });
        await h.db[owner]
          .prepare("INSERT INTO app_storage_pins(hash,reason) VALUES(?,'operator-public-fixture')")
          .bind(hash)
          .run();
        retained.push([owner, hash]);
      }
      await new MailQueue(new MultiD1(h.db).users(), secret).enqueue(
        user.id,
        'TRANSACTIONAL',
        'rc3-private-mail',
        {
          to: user.primaryEmail!,
          subject: 'Private',
          text: 'Private reset token',
        },
      );
      const mail = await h.db.D1_USERS.prepare('SELECT object_hash FROM app_mail WHERE user_id=?')
        .bind(user.id)
        .first<any>();
      const old = await backupDatabases(h.db, secret, {
        rawWritersStopped: true,
        verifyReferences: verifyCrossShardReferences,
      });
      await requestMultiD1Erasure(new MultiD1(h.db).users(), user.id, 'a'.repeat(64));
      const ledger = await sealErasureLedger(h.db.D1_USERS, secret);
      // Historical archives require a separately authenticated current revocation ledger.
      await restoreDatabases(old, secret, target.db, {
        currentErasureLedger: ledger,
        isolatedEmptyTargets: true,
        verifyReferences: verifyCrossShardReferences,
        execute: async (owner, sql) => {
          for (const part of splitSql(sql)) await target.db[owner].prepare(part).run();
        },
      });
      assert.equal(
        (
          await target.db.D1_USERS.prepare('SELECT status,primary_email FROM app_users WHERE id=?')
            .bind(user.id)
            .first<any>()
        )?.status,
        'DELETED',
      );
      await target.restart();
      let maximum = 0,
        awaiting = false;
      for (let i = 0; i < 240; i++) {
        const router = new MultiD1(target.db);
        const result = await continueMultiD1Erasure(router.users());
        maximum = Math.max(maximum, router.metrics.statements);
        if ('awaitingGc' in result && result.awaitingGc) {
          awaiting = true;
          break;
        }
        if (i === 17) await target.restart();
      }
      assert.equal(awaiting, true);
      assert.ok(maximum < 50);
      let verifiedArchive: any;
      await target.db.D1_TEAM_1.prepare(
        "CREATE TRIGGER rc3_maintenance_crash BEFORE INSERT ON app_storage_retention_plans BEGIN SELECT RAISE(ABORT,'maintenance interrupted'); END",
      ).run();
      await assert.rejects(
        maintainMultiD1(target.db, secret, {
          rawWritersStopped: true,
          now: Date.now(),
          persistAndReadBack: async (archive) => {
            const path = target.directory + '/resume-archive.json';
            await writeFile(path, JSON.stringify(archive), { mode: 0o600 });
            verifiedArchive = { path, archive: JSON.parse(await readFile(path, 'utf8')) };
            return verifiedArchive;
          },
        }),
        /maintenance interrupted/,
      );
      for (const owner of DATABASE_OWNERS)
        assert.equal(
          (
            await target.db[owner]
              .prepare('SELECT locked FROM app_storage_epoch WHERE id=1')
              .first<any>()
          )?.locked,
          1,
        );
      await target.restart();
      await target.db.D1_TEAM_1.prepare('DROP TRIGGER rc3_maintenance_crash').run();
      const resumed = await resumeMultiD1Maintenance(target.db, secret, verifiedArchive, {
        rawWritersStopped: true,
        now: Date.now(),
      });
      assert.equal(resumed.length, 10);
      const result = await maintainMultiD1(target.db, secret, {
        rawWritersStopped: true,
        now: Date.now(),
        persistAndReadBack: async (archive) => {
          const path = target.directory + '/encrypted-before-maintenance.json';
          await writeFile(path, JSON.stringify(archive), { mode: 0o600 });
          return { path, archive: JSON.parse(await readFile(path, 'utf8')) };
        },
      });
      assert.equal(result.length, 10);
      assert.equal(
        await target.db.D1_USERS.prepare('SELECT hash FROM app_payload_objects WHERE hash=?')
          .bind(mail.object_hash)
          .first(),
        null,
      );
      assert.equal(
        await target.db.D1_USERS.prepare('SELECT user_id FROM app_credentials WHERE user_id=?')
          .bind(user.id)
          .first(),
        null,
      );
      assert.equal(
        (
          await target.db.D1_USERS.prepare('SELECT status FROM app_account_erasure WHERE user_id=?')
            .bind(user.id)
            .first<any>()
        )?.status,
        'COMPLETE',
      );
      assert.equal(
        (
          await target.db.D1_USERS.prepare(
            'SELECT password_hash FROM app_credentials WHERE user_id=?',
          )
            .bind(keep.id)
            .first<any>()
        )?.password_hash,
        'keep-phc',
      );
      assert.equal(
        (
          await target.db.D1_USERS.prepare(
            'SELECT preferences_json FROM app_settings WHERE user_id=?',
          )
            .bind(keep.id)
            .first<any>()
        )?.preferences_json,
        '{"points":42}',
      );
      for (const [owner, hash] of retained)
        assert.ok(
          await target.db[owner as keyof typeof target.db]
            .prepare('SELECT hash FROM app_payload_objects WHERE hash=?')
            .bind(hash)
            .first(),
        );
      console.log(
        'RC3_ERASURE',
        JSON.stringify({
          maximumQueries: maximum,
          databases: 10,
          oldArchiveRevoked: true,
          privateMailDeleted: true,
        }),
      );
    } finally {
      await h.close();
      await target.close();
    }
  },
);

test(
  'uncertain external transfers remain protected and cannot be mistaken for completed erasure',
  { timeout: 120000 },
  async () => {
    const h = await multiHarness();
    try {
      await h.db.D1_USERS.prepare(
        "INSERT INTO app_users(id,status,primary_email,created_at,updated_at) VALUES('uncertain-user','ACTIVE','uncertain@example.invalid',1,1)",
      ).run();
      const actor = 'b'.repeat(64),
        hash = await new MultiD1(h.db)
          .users()
          .put({ uncertainProviderReceipt: 'must reconcile before destruction' });
      await h.db.D1_USERS.prepare(
        "INSERT INTO app_sportsbook_transfer_jobs(id,sportsbook,actor,fingerprint,region,object_hash,status,created_at,expires_at,next_poll_at) VALUES('uncertain-transfer','synthetic-book',?,'original-fingerprint','US',?,'pending',1,2,1)",
      )
        .bind(actor, hash)
        .run();
      const before = await h.db.D1_USERS.prepare(
        "SELECT * FROM app_sportsbook_transfer_jobs WHERE id='uncertain-transfer'",
      ).first();
      await requestMultiD1Erasure(new MultiD1(h.db).users(), 'uncertain-user', actor);
      let review = false;
      for (let i = 0; i < 180; i++) {
        const result = await continueMultiD1Erasure(new MultiD1(h.db).users());
        if ('reviewRequired' in result && result.reviewRequired) {
          review = true;
          break;
        }
      }
      assert.equal(review, true);
      assert.equal(
        (
          await h.db.D1_USERS.prepare(
            "SELECT status FROM app_account_erasure WHERE user_id='uncertain-user'",
          ).first<any>()
        )?.status,
        'REVIEW_REQUIRED',
      );
      assert.deepEqual(
        await h.db.D1_USERS.prepare(
          "SELECT * FROM app_sportsbook_transfer_jobs WHERE id='uncertain-transfer'",
        ).first(),
        before,
      );
      assert.equal(
        (
          await h.db.D1_USERS.prepare(
            "SELECT status FROM app_users WHERE id='uncertain-user'",
          ).first<any>()
        )?.status,
        'DELETED',
      );
      assert.ok(
        await h.db.D1_USERS.prepare('SELECT hash FROM app_payload_objects WHERE hash=?')
          .bind(hash)
          .first(),
      );
    } finally {
      await h.close();
    }
  },
);
