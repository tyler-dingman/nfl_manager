import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { harness } from './harness';
import {
  Storage,
  ApplicationDocuments,
  digest,
  utf8,
  objectKey,
  type SqlDatabase,
} from '../../../packages/storage/core';
import { PrivateObjects, type Bucket } from '../../../packages/storage/objects';
import { encodeObject, decodeObject } from '../../../packages/storage/codec';
import { JsonTree } from '../../../packages/storage/json-tree';
import { D1AuthRepository } from '../../../packages/storage/auth';
import { D1DailyTrivia } from '../../../packages/storage/trivia';
import { D1Rewards } from '../../../packages/storage/rewards';
import { D1ApplicationSettings, maintainTemporaryData } from '../../../packages/storage/lifecycle';

test('gzip remains lossless, bounded, legacy compatible and resistant to tampering', async () => {
  const raw = utf8.encode('Football 🏈'.repeat(30000)),
    hash = await digest(raw),
    packed = await encodeObject(raw);
  assert(packed.length < raw.length / 100);
  assert.deepEqual(await decodeObject(packed, hash), raw);
  assert.deepEqual(await decodeObject(raw, hash), raw);
  const random = randomBytes(200000);
  assert.deepEqual(await encodeObject(random), random);
  packed[packed.length - 4] ^= 1;
  await assert.rejects(decodeObject(packed, hash));
  await assert.rejects(decodeObject(raw, '0'.repeat(64)));
  const bomb = new Uint8Array(
    await new Response(
      new Blob(['x'.repeat(5000000)]).stream().pipeThrough(new CompressionStream('gzip')),
    ).arrayBuffer(),
  );
  await assert.rejects(decodeObject(bomb, '0'.repeat(64)), /limit/);
});

test('immutable JSON subtrees preserve every revision and literal reference-shaped values', async () => {
  const h = await harness();
  try {
    const primary = await h.mf.getR2Bucket('EDITORIAL_ARCHIVE'),
      backup = await h.mf.getR2Bucket('EDITORIAL_BACKUP');
    const objects = new PrivateObjects(primary as unknown as Bucket, backup as unknown as Bucket),
      s = new Storage(h.binding as unknown as SqlDatabase, objects);
    const user = (await new D1AuthRepository(s).createEmailUser({
      email: 'tree@example.invalid',
      passwordHash: 'original',
    }))!;
    const docs = new ApplicationDocuments(s),
      tree = new JsonTree(s);
    const data = {
      players: Array.from({ length: 512 }, (_, i) => ({
        id: `player-${i}`,
        contract: randomBytes(128).toString('hex'),
        team: 'KC',
      })),
      metadata: { $foReference: 'literal', root: 'literal' },
      count: 0,
    };
    const history: any[] = [];
    const hashes: string[] = [];
    for (let revision = 0; revision < 6; revision++) {
      data.count = revision;
      await docs.commit(
        user.id,
        'front-office',
        'save-original',
        revision,
        `command-${revision}`,
        data,
      );
      history.push(structuredClone(data));
      const [row] = await s.rows<any>('SELECT object_hash FROM app_heads WHERE owner_id=?', [
        user.id,
      ]);
      hashes.push(row.object_hash);
    }
    assert.deepEqual((await docs.read(user.id, 'front-office', 'save-original'))!.value, data);
    assert.equal(await docs.read('not-owner', 'front-office', 'save-original'), null);
    for (let i = 0; i < hashes.length; i++) {
      const envelope = await s.get<any>(hashes[i]);
      assert.deepEqual(await tree.get(envelope.root), history[i]);
    }
    const before = objects.writes;
    assert.equal(
      (await docs.commit(user.id, 'front-office', 'save-original', 5, 'command-5', data)).replayed,
      true,
    );
    assert.equal(objects.writes, before);
    await assert.rejects(
      docs.commit(user.id, 'front-office', 'save-original', 1, 'conflicting-command', data),
    );
    const row = (await s.rows<any>('SELECT object_hash FROM app_heads'))[0];
    await primary.put(objectKey(row.object_hash), 'corrupt');
    assert.deepEqual((await docs.read(user.id, 'front-office', 'save-original'))!.value, data);
  } finally {
    await h.close();
  }
});

test('daily trivia, stats and reward history commit atomically under concurrency and ignore supplied answer truth', async () => {
  const h = await harness();
  try {
    const s = new Storage(
      h.binding as unknown as SqlDatabase,
      new PrivateObjects((await h.mf.getR2Bucket('EDITORIAL_ARCHIVE')) as unknown as Bucket),
    );
    const auth = new D1AuthRepository(s),
      user = (await auth.createEmailUser({
        email: 'trivia@example.invalid',
        passwordHash: 'original',
      }))!,
      other = (await auth.createEmailUser({
        email: 'other@example.invalid',
        passwordHash: 'original',
      }))!;
    await s
      .statement(
        "INSERT INTO app_trivia_questions(id,team_id,question,answer_a,answer_b,answer_c,answer_d,correct_answer,explanation,category,verified) VALUES('original-q','KC','Question?','a','b','c','d','A','Source explanation','NFL',1)",
      )
      .run();
    await s
      .statement(
        "INSERT INTO app_reward_definitions(id,type,title,description,threshold_yards) VALUES('original-reward','DISCOUNT','Reward','Original reward',1)",
      )
      .run();
    const trivia = new D1DailyTrivia(s),
      daily = await trivia.ensureDailyQuestion('KC', '2026-10-18');
    await trivia.markDailyPresented(user.id, daily.dailyQuestionId);
    const input = {
      userId: user.id,
      dailyQuestionId: daily.dailyQuestionId,
      questionId: 'original-q',
      selectedAnswer: 'A',
      correctAnswer: 'D',
      responseTimeMs: -9999,
    };
    const answers = await Promise.all(
      Array.from({ length: 6 }, () => trivia.answerDailyQuestion(input)),
    );
    assert.equal(answers.filter((r) => r.accepted).length, 1);
    assert.equal((await trivia.getTriviaStats(user.id)).questionsAnswered, 1);
    assert.equal((await trivia.getMoveTheChainsAccount(user.id)).lifetimeYards, 1);
    assert.equal((await s.rows('SELECT * FROM app_user_rewards')).length, 1);
    assert.equal(await trivia.getDailyAnswer(other.id, daily.dailyQuestionId), null);
    const falseAnswer = await trivia.answerDailyQuestion({
      ...input,
      userId: other.id,
      selectedAnswer: 'B',
      correctAnswer: 'B',
    });
    assert.equal(falseAnswer.result.correct, false);
    assert.equal((await trivia.getMoveTheChainsAccount(other.id)).lifetimeYards, 0);
    await assert.rejects(trivia.answerDailyQuestion({ ...input, questionId: 'another-question' }));
    const rewards = new D1Rewards(s);
    await Promise.all(
      Array.from({ length: 4 }, () =>
        rewards.award({
          userId: user.id,
          action: 'CATCH_UP_COMPLETE',
          sourceType: 'STORY',
          sourceId: 'original-story',
        }),
      ),
    );
    assert.equal((await trivia.getMoveTheChainsAccount(user.id)).lifetimeYards, 2);
    assert.equal((await s.rows('SELECT * FROM app_reward_events')).length, 2);
    assert.equal((await s.rows('PRAGMA foreign_key_check')).length, 0);
  } finally {
    await h.close();
  }
});

test('bounded lifecycle archives consumed expired capabilities and retains active tokens and valuable records', async () => {
  const h = await harness();
  try {
    const s = new Storage(
        h.binding as unknown as SqlDatabase,
        new PrivateObjects((await h.mf.getR2Bucket('EDITORIAL_ARCHIVE')) as unknown as Bucket),
      ),
      auth = new D1AuthRepository(s);
    const user = (await auth.createEmailUser({
      email: 'retention@example.invalid',
      passwordHash: 'original',
    }))!;
    const now = Date.now();
    for (let i = 0; i < 23; i++)
      await s
        .statement(
          "INSERT INTO app_tokens(id,user_id,type,token_hash,expires_at,consumed_at) VALUES(?,?,'PASSWORD_RESET',?,?,?)",
          [
            `token-${i}`,
            user.id,
            `original-hash-${i}`,
            now - 40 * 86400000,
            i === 22 ? null : now - 41 * 86400000,
          ],
        )
        .run();
    const result = await maintainTemporaryData(s, now);
    assert.equal(result.archivedConsumedTokens, 15);
    const packs = await s.rows<any>('SELECT * FROM app_history_packs');
    const original = await s.get<any>(packs[0].object_hash);
    assert.equal(original.rows.length, 15);
    assert.equal((await s.rows('SELECT id FROM app_tokens')).length, 8);
    assert.equal((await s.rows('SELECT id FROM app_users')).length, 1);
    await maintainTemporaryData(s, now);
    assert.equal((await s.rows('SELECT id FROM app_tokens')).length, 1);
    const settings = new D1ApplicationSettings(s);
    assert(await settings.compareAndSet('public-setting', 0, { enabled: false }));
    const concurrent = await Promise.all([
      settings.compareAndSet('public-setting', 1, { enabled: true }),
      settings.compareAndSet('public-setting', 1, { enabled: false }),
    ]);
    assert.equal(concurrent.filter(Boolean).length, 1);
    assert.equal((await settings.read('public-setting'))!.version, 2);
  } finally {
    await h.close();
  }
});
