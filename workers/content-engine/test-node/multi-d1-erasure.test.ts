import test from 'node:test';
import assert from 'node:assert/strict';
import { multiHarness } from '../test/multi-harness';
import { MultiD1 } from '../../../packages/storage/multi-d1';
import {
  requestMultiD1Erasure,
  continueMultiD1Erasure,
} from '../../../packages/storage/account-erasure-multi';

test(
  'bounded multi-D1 erasure revokes immediately, survives restart, isolates users and requires shared/legal review',
  { timeout: 120000 },
  async () => {
    const h = await multiHarness();
    try {
      for (const id of ['erase-me', 'keep-me'])
        await h.db.D1_USERS.prepare(
          "INSERT INTO app_users(id,display_name,primary_email,status,created_at,updated_at) VALUES(?,?,?,'ACTIVE',1,1)",
        )
          .bind(id, id, id + '@test.invalid')
          .run();
      for (let i = 0; i < 101; i++)
        await h.db.D1_USERS.prepare(
          "INSERT INTO app_saved_content(id,user_id,content_type,content_id,title,metadata_json,created_at) VALUES(?,'erase-me','OTHER',?,'private','{}',1)",
        )
          .bind('s' + i, 'c' + i)
          .run();
      await h.db.D1_USERS.prepare(
        "INSERT INTO app_settings(user_id,preferences_json,updated_at) VALUES('keep-me','{\"private\":true}',1)",
      ).run();
      await h.db.D1_USERS.prepare(
        "INSERT INTO app_crews(id,name,team_abbr,owner_user_id) VALUES('crew','Shared crew','KC','erase-me')",
      ).run();
      await h.db.D1_USERS.prepare(
        "INSERT INTO app_crew_shares(id,crew_id,sender_user_id,visibility,content_id,content_type,href,title) VALUES('share','crew','erase-me','CREW','article','STORY','/article','Shared article')",
      ).run();
      await h.db.D1_USERS.prepare(
        "INSERT INTO app_crew_share_recipients(share_id,user_id) VALUES('share','keep-me')",
      ).run();
      await h.db.D1_USERS.prepare(
        "INSERT INTO app_huddle_messages(id,room,user_id,body,client_id) VALUES('message','KC','erase-me','private text','message-client')",
      ).run();
      await h.db.D1_USERS.prepare(
        "INSERT INTO app_huddle_messages(id,room,user_id,body,client_id,reply_to) VALUES('reply','KC','keep-me','other user reply','reply-client','message')",
      ).run();
      let r = new MultiD1(h.db);
      await assert.rejects(
        requestMultiD1Erasure(r.team('KC'), 'keep-me', 'a'.repeat(64)),
        /Private owner/,
      );
      await assert.rejects(requestMultiD1Erasure(r.users(), 'missing-user', 'a'.repeat(64)));
      r = new MultiD1(h.db);
      await requestMultiD1Erasure(r.users(), 'erase-me', 'a'.repeat(64));
      assert.ok(r.metrics.statements < 30);
      assert.equal(
        (
          await h.db.D1_USERS.prepare(
            "SELECT status FROM app_users WHERE id='erase-me'",
          ).first<any>()
        )?.status,
        'DELETED',
      );
      await assert.rejects(
        h.db.D1_USERS.prepare(
          "INSERT INTO app_settings(user_id,updated_at) VALUES('erase-me',1)",
        ).run(),
        /erasure/,
      );
      await assert.rejects(
        h.db.D1_USERS.prepare("UPDATE app_users SET status='ACTIVE' WHERE id='erase-me'").run(),
        /reactivated/,
      );
      await assert.rejects(
        h.db.D1_USERS.prepare(
          "UPDATE app_crew_share_recipients SET created_at=2 WHERE share_id='share' AND user_id='keep-me'",
        ).run(),
        /erasure/,
      );
      await h.restart();
      let max = 0,
        done = false;
      for (let i = 0; i < 180; i++) {
        r = new MultiD1(h.db);
        const step = await continueMultiD1Erasure(r.users());
        max = Math.max(max, r.metrics.statements);
        if ('reviewRequired' in step) {
          done = true;
          break;
        }
        if (i === 8) await h.restart();
      }
      assert.equal(done, true);
      assert.ok(max < 30);
      assert.equal(
        (
          await h.db.D1_USERS.prepare(
            "SELECT count(*) AS n FROM app_saved_content WHERE user_id='erase-me'",
          ).first<any>()
        )?.n,
        0,
      );
      assert.equal(
        (
          await h.db.D1_USERS.prepare(
            "SELECT preferences_json FROM app_settings WHERE user_id='keep-me'",
          ).first<any>()
        )?.preferences_json,
        '{"private":true}',
      );
      assert.equal(
        (
          await h.db.D1_USERS.prepare(
            "SELECT count(*) n FROM app_crew_shares WHERE id='share'",
          ).first<any>()
        )?.n,
        0,
      );
      assert.equal(
        (
          await h.db.D1_USERS.prepare(
            "SELECT body FROM app_huddle_messages WHERE id='message'",
          ).first<any>()
        )?.body,
        '[deleted]',
      );
      assert.equal(
        (
          await h.db.D1_USERS.prepare(
            "SELECT body FROM app_huddle_messages WHERE id='reply'",
          ).first<any>()
        )?.body,
        'other user reply',
      );
      assert.equal(
        (await h.db.D1_USERS.prepare("SELECT name FROM app_crews WHERE id='crew'").first<any>())
          ?.name,
        'Shared crew',
      );
      assert.deepEqual(await continueMultiD1Erasure(new MultiD1(h.db).users()), { idle: true });
      console.log(
        JSON.stringify({ maxQueries: max, erasedSavedRows: 101, finalStatus: 'REVIEW_REQUIRED' }),
      );
    } finally {
      await h.close();
    }
  },
);
