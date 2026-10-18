import test from 'node:test';
import assert from 'node:assert/strict';
import { harness } from './harness';
import { Storage, ApplicationDocuments, type SqlDatabase } from '../../../packages/storage/core';
import { PrivateObjects, type Bucket } from '../../../packages/storage/objects';
import { D1AuthRepository } from '../../../packages/storage/auth';
import { D1UserRepository } from '../../../packages/storage/user';

test('saved metadata cannot inject another owner private pointer or bypass envelope ownership', async () => {
  const h = await harness();
  try {
    const objects = new PrivateObjects(
        (await h.mf.getR2Bucket('EDITORIAL_ARCHIVE')) as unknown as Bucket,
      ),
      s = new Storage(h.binding as unknown as SqlDatabase, objects),
      auth = new D1AuthRepository(s),
      users = new D1UserRepository(s);
    const victim = (await auth.createEmailUser({
        email: 'victim@example.invalid',
        passwordHash: 'preserved',
      }))!,
      attacker = (await auth.createEmailUser({
        email: 'attacker@example.invalid',
        passwordHash: 'preserved',
      }))!;
    await users.saveContent(victim.id, {
      contentType: 'STORY',
      contentId: 'private-original-id',
      title: 'Private fixture',
      metadata: { secret: 'x'.repeat(200000) },
    });
    const [record] = await s.rows<{ metadata_hash: string }>(
      'SELECT metadata_hash FROM app_saved_content WHERE user_id=?',
      [victim.id],
    );
    await users.saveContent(attacker.id, {
      contentType: 'OTHER',
      contentId: 'attack-id',
      title: 'Literal user metadata',
      metadata: { $private: record.metadata_hash },
    });
    const reads = objects.reads,
      visible = await users.listSavedContent(attacker.id);
    assert.deepEqual(visible[0].metadata, { $private: record.metadata_hash });
    assert.equal(objects.reads, reads);
    assert(!('metadata_hash' in visible[0]));
    // Even a corrupted server column cannot return a different owner's payload.
    await s.batch([
      s.statement('UPDATE app_saved_content SET metadata_hash=? WHERE user_id=?', [
        record.metadata_hash,
        attacker.id,
      ]),
    ]);
    await assert.rejects(users.listSavedContent(attacker.id), /ownership mismatch/);
    assert.equal((await users.listSavedContent(victim.id))[0].metadata.secret.length, 200000);
  } finally {
    await h.close();
  }
});

test('D1 identities, settings, sessions, replay detection, ownership and restart', async () => {
  const h = await harness(true);
  try {
    const objects = new PrivateObjects(
      (await h.mf.getR2Bucket('EDITORIAL_ARCHIVE')) as unknown as Bucket,
      (await h.mf.getR2Bucket('EDITORIAL_BACKUP')) as unknown as Bucket,
    );
    const s = new Storage(h.binding as unknown as SqlDatabase, objects),
      auth = new D1AuthRepository(s),
      users = new D1UserRepository(s);
    const a = (await auth.createEmailUser({
        email: 'a@example.invalid',
        passwordHash: 'original-argon2-hash',
      }))!,
      b = (await auth.createEmailUser({
        email: 'b@example.invalid',
        passwordHash: 'other-original-hash',
      }))!;
    await assert.rejects(
      auth.createEmailUser({ email: 'A@example.invalid', passwordHash: 'duplicate' }),
    );
    assert.equal((await s.rows('SELECT id FROM app_users')).length, 2);
    await users.updatePreferences(a.id, { reducedMotion: true, preferredTeamId: 'KC' });
    await users.setPrimaryTeam(a.id, 'KC');
    await users.setPrimaryTeam(a.id, 'SEA');
    assert.equal((await users.listTeamFollows(a.id)).filter((r) => r.isPrimary).length, 1);
    assert.equal((await users.getPreferences(b.id)).reducedMotion, false);
    await users.saveContent(a.id, {
      contentType: 'STORY',
      contentId: 'original-saved-id',
      title: 'Original',
      href: '/the-beat/original-saved-id',
      metadata: { body: 'x'.repeat(200000) },
    });
    assert.equal((await users.listSavedContent(b.id)).length, 0);
    await auth.createSession({ userId: a.id, token: 'synthetic-token', deviceId: 'owned-device' });
    const rotated = await auth.rotateSession('synthetic-token', 'replacement', {});
    assert(rotated);
    assert(await auth.findActiveSessionById(rotated.id, a.id));
    assert.equal(await auth.findActiveSessionById(rotated.id, b.id), null);
    assert.equal(await auth.rotateSession('synthetic-token', 'replayed-token', {}), null);
    assert.equal(await auth.findActiveSessionById(rotated.id, a.id), null);
    await auth.createOneTimeToken(a.id, 'PASSWORD_RESET', 'single-reset-token', 30);
    const resets = await Promise.allSettled([
      auth.resetPassword('single-reset-token', 'new-hash'),
      auth.resetPassword('single-reset-token', 'other-hash'),
    ]);
    assert.equal(resets.filter((r) => r.status === 'fulfilled').length, 1);
    const db = await h.restart(),
      next = new Storage(
        db as unknown as SqlDatabase,
        new PrivateObjects((await h.mf.getR2Bucket('EDITORIAL_ARCHIVE')) as unknown as Bucket),
      );
    assert.equal((await new D1UserRepository(next).getPreferences(a.id)).preferredTeamId, 'SEA');
    assert.equal(
      (await new D1UserRepository(next).listSavedContent(a.id))[0].metadata.body.length,
      200000,
    );
    assert.notEqual(
      (await new D1AuthRepository(next).getCredential(a.id))?.password_hash,
      'original-argon2-hash',
    );
  } finally {
    await h.close();
  }
});
test('large owned game/slip/trivia/config aggregates commit atomically with R2 and reject stale updates', async () => {
  const h = await harness();
  try {
    const s = new Storage(
      h.binding as unknown as SqlDatabase,
      new PrivateObjects(
        (await h.mf.getR2Bucket('EDITORIAL_ARCHIVE')) as unknown as Bucket,
        (await h.mf.getR2Bucket('EDITORIAL_BACKUP')) as unknown as Bucket,
      ),
    );
    const auth = new D1AuthRepository(s),
      user = (await auth.createEmailUser({
        email: 'owner@example.invalid',
        passwordHash: 'preserved',
      }))!,
      docs = new ApplicationDocuments(s);
    for (const kind of [
      'front-office',
      'saved-bet',
      'trivia-result',
      'points',
      'application-config',
    ]) {
      const command = crypto.randomUUID(),
        payload = {
          originalId: 'original-id',
          relationships: ['original-reference'],
          state: 'x'.repeat(kind === 'front-office' ? 2100000 : 100),
        };
      await docs.commit(user.id, kind, 'original-id', 0, command, payload);
      assert.equal(
        (await docs.commit(user.id, kind, 'original-id', 0, command, payload)).replayed,
        true,
      );
      assert.equal(await docs.read('other-owner', kind, 'original-id'), null);
      const results = await Promise.allSettled([
        docs.commit(user.id, kind, 'original-id', 1, crypto.randomUUID(), { value: 1 }),
        docs.commit(user.id, kind, 'original-id', 1, crypto.randomUUID(), { value: 2 }),
      ]);
      assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
      assert.equal((await docs.read(user.id, kind, 'original-id'))?.revision, 2);
    }
    assert.equal((await s.rows('SELECT * FROM app_assertions')).length, 0);
  } finally {
    await h.close();
  }
});
