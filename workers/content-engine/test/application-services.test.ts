import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, mkdir } from 'node:fs/promises';
import { harness } from './harness';
import { Storage, ApplicationDocuments, type SqlDatabase } from '../../../packages/storage/core';
import { PrivateObjects, type Bucket } from '../../../packages/storage/objects';
import { D1AuthRepository } from '../../../packages/storage/auth';
import { D1UserRepository } from '../../../packages/storage/user';
import {
  MailQueue,
  unseal,
  ResendEmailProvider,
  type EmailProvider,
} from '../../../packages/storage/mail';
import { SharedInference, InferenceQuotaError, lexicalSearch } from '../../../packages/storage/ai';
import { checkpoint, restore, type SnapshotObjects } from '../../../packages/storage/cold-recovery';
const secret = 'synthetic-recovery-key-at-least-32-characters';
const store = async (h: Awaited<ReturnType<typeof harness>>) =>
  new Storage(
    h.binding as unknown as SqlDatabase,
    new PrivateObjects((await h.mf.getR2Bucket('EDITORIAL_ARCHIVE')) as unknown as Bucket),
  );
function bucketObjects(bucket: R2Bucket): SnapshotObjects {
  return {
    keys: async () => {
      const result: string[] = [];
      let cursor: string | undefined;
      do {
        const page = await bucket.list({ cursor });
        result.push(...page.objects.map((o) => o.key));
        cursor = page.truncated ? page.cursor : undefined;
      } while (cursor);
      return result;
    },
    get: async (key) => {
      const value = await bucket.get(key);
      return value ? new Uint8Array(await value.arrayBuffer()) : null;
    },
    putImmutable: async (key, bytes) => {
      const prior = await bucket.get(key);
      if (prior) assert.deepEqual(new Uint8Array(await prior.arrayBuffer()), bytes);
      else await bucket.put(key, bytes);
    },
  };
}
test('mail encryption, dedupe, opt-out, free quota, concurrent workers and ambiguous delivery', async () => {
  const h = await harness();
  try {
    const s = await store(h),
      user = (await new D1AuthRepository(s).createEmailUser({
        email: 'mail@example.invalid',
        passwordHash: 'preserved',
      }))!,
      mail = new MailQueue(s, secret);
    await new D1AuthRepository(s).verifyUserEmail(user.id);
    await mail.subscribe(user.id, true);
    let calls = 0;
    const provider: EmailProvider = {
      name: 'fixture',
      dailyLimit: 100,
      monthlyLimit: 3000,
      idempotencyMs: 86400000,
      send: async () => ({ id: `fixture-${++calls}` }),
    };
    const message = {
      to: 'mail@example.invalid',
      subject: 'Synthetic daily briefing',
      text: 'Private test content',
    };
    for (let i = 0; i < 62; i++) await mail.enqueue(user.id, 'EDITORIAL', `briefing-${i}`, message);
    await mail.enqueue(user.id, 'EDITORIAL', 'briefing-0', message);
    assert.equal((await s.rows('SELECT id FROM app_mail')).length, 62);
    const [row] = await s.rows<any>('SELECT object_hash FROM app_mail LIMIT 1'),
      encrypted = await s.get<any>(row.object_hash);
    assert(!JSON.stringify(encrypted).includes(message.text));
    assert.equal((await unseal<any>(encrypted, secret)).text, message.text);
    await assert.rejects(unseal(encrypted, 'wrong-key-that-is-at-least-32-characters'));
    // A deterministic processing clock keeps late enqueues eligible on slow CI.
    const now = Date.parse('2099-01-15T12:00:00Z');
    for (let i = 0; i < 24; i++)
      await Promise.all([mail.process(provider, now, 25), mail.process(provider, now, 25)]);
    assert.equal(calls, 60);
    assert.equal((await s.rows("SELECT id FROM app_mail WHERE status='READY'")).length, 2);
    await mail.enqueue(user.id, 'TRANSACTIONAL', 'reset-token', message);
    await mail.process(provider, now + 1000, 25);
    assert.equal(calls, 61);
    const token = await mail.unsubscribeToken(user.id, now + 86400000);
    await assert.rejects(mail.unsubscribe(token + 'bad', now));
    await mail.unsubscribe(token, now);
    await mail.process(provider, now + 2000, 25);
    assert.equal((await s.rows("SELECT id FROM app_mail WHERE status='SUPPRESSED'")).length, 2);
    await mail.enqueue(user.id, 'TRANSACTIONAL', 'lost-ack', message);
    await mail.process(
      {
        ...provider,
        send: async () => {
          calls++;
          throw Error('Accepted but acknowledgement lost');
        },
      },
      now + 3000,
    );
    await mail.process(provider, now + 4000);
    assert.equal(calls, 62);
    assert.equal((await s.rows("SELECT id FROM app_mail WHERE status='UNCERTAIN'")).length, 1);
    await mail.enqueue(user.id, 'TRANSACTIONAL', 'zero-quota', message);
    await mail.process({ ...provider, name: 'zero', dailyLimit: 0 }, now + 5000);
    assert.equal(calls, 62);
    let key = '';
    const resend = new ResendEmailProvider(
      'synthetic-not-a-real-key',
      'Synthetic <mail@example.invalid>',
      async (_url, init) => {
        key = new Headers(init?.headers).get('idempotency-key')!;
        return Response.json({ id: 'fixture-id' });
      },
    );
    await resend.send(message, 'private-long-id');
    assert.match(key, /^[a-f0-9]{64}$/);
    const redirecting = new ResendEmailProvider(
      'synthetic',
      'mail@example.invalid',
      async (_url, init) => {
        assert.equal(init?.redirect, 'manual');
        return new Response(null, {
          status: 302,
          headers: { location: 'https://example.invalid/never-follow' },
        });
      },
    );
    await assert.rejects(redirecting.send(message, 'safe-key'), /HTTP 302/);
  } finally {
    await h.close();
  }
});
test('approved daily team email is queued once, preserves sources and honors email preferences', async () => {
  const h = await harness();
  try {
    const s = await store(h),
      auth = new D1AuthRepository(s),
      user = (await auth.createEmailUser({
        email: 'daily@example.invalid',
        passwordHash: 'preserved',
      }))!,
      preferences = new D1UserRepository(s),
      queue = new MailQueue(s, secret);
    await auth.verifyUserEmail(user.id);
    await preferences.updatePreferences(user.id, { preferredTeamId: 'KC', emailEnabled: true });
    await queue.subscribe(user.id, true);
    const hash = await s.put({
      approved: true,
      id: 'original-edition',
      team: 'KC',
      date: new Date().toISOString().slice(0, 10),
      subject: 'Daily fixture',
      text: 'Source attribution: https://example.invalid/original',
    });
    await queue.enqueueDailyBriefing(hash, 'https://example.invalid');
    await queue.enqueueDailyBriefing(hash, 'https://example.invalid');
    assert.equal((await s.rows('SELECT id FROM app_mail')).length, 1);
    const [row] = await s.rows<any>('SELECT object_hash FROM app_mail'),
      message = await unseal<any>(await s.get<any>(row.object_hash), secret);
    assert.match(message.text, /https:\/\/example.invalid\/original/);
    assert.match(message.unsubscribeUrl, /api\/email\/unsubscribe/);
    await preferences.updatePreferences(user.id, { emailEnabled: false });
    const other = await s.put({
      approved: true,
      id: 'next-edition',
      team: 'KC',
      date: new Date().toISOString().slice(0, 10),
      subject: 'Next fixture',
      text: 'Retained source',
    });
    assert.equal(
      (await queue.enqueueDailyBriefing(other, 'https://example.invalid')).considered,
      0,
    );
  } finally {
    await h.close();
  }
});
test('shared inference is source-versioned, quota-reserved and never invents a fallback; FTS preserves attribution', async () => {
  const h = await harness();
  try {
    const s = await store(h),
      cache = new SharedInference(s, 7);
    let calls = 0;
    const provider = {
        model: 'fixture-grounded',
        maximumNeurons: () => 3,
        generate: async () => ({ text: `Grounded result ${++calls}` }),
      },
      input = {
        team: 'KC',
        sourceVersion: 'v1',
        policy: 'reviewed-v1',
        prompt: 'Summarize the supplied source',
        maxOutputTokens: 100,
      };
    assert.equal((await cache.generate(provider, input)).cached, false);
    assert.equal((await cache.generate(provider, input)).cached, true);
    assert.equal(calls, 1);
    const both = await Promise.allSettled([
      cache.generate(provider, { ...input, sourceVersion: 'v2' }),
      cache.generate(provider, { ...input, sourceVersion: 'v2' }),
    ]);
    assert.equal(both.filter((x) => x.status === 'fulfilled').length, 1);
    assert.equal(calls, 2);
    await assert.rejects(
      cache.generate(provider, { ...input, sourceVersion: 'v3' }),
      InferenceQuotaError,
    );
    assert.equal(calls, 2);
    assert.throws(() => new SharedInference(s, 10001));
    await s.batch([
      s.statement(
        'INSERT INTO app_search(id,team_id,title,content,source_id,source_url) VALUES(?,?,?,?,?,?)',
        [
          'original-story',
          'KC',
          'Chiefs film review',
          'Mahomes passing evidence',
          'original-source',
          'https://example.invalid/source',
        ],
      ),
    ]);
    const results = await lexicalSearch(s, 'Mahomes passing', 'KC');
    assert.equal(results.length, 1);
    assert.equal(results[0].source_url, 'https://example.invalid/source');
    assert.equal((await lexicalSearch(s, 'Mahomes', 'SEA')).length, 0);
    assert.equal((await lexicalSearch(s, '"; DROP TABLE app_users; --', 'KC')).length, 0);
  } finally {
    await h.close();
  }
});
test('cold cross-store checkpoint restores all logical tables, original IDs and large objects after interruption', async () => {
  const h = await harness(),
    target = await harness(true),
    backupHarness = await harness();
  try {
    const s = await store(h),
      b = await store(backupHarness),
      user = (await new D1AuthRepository(s).createEmailUser({
        email: 'restore@example.invalid',
        passwordHash: 'original-argon2-hash',
      }))!,
      docs = new ApplicationDocuments(s);
    await new D1AuthRepository(s).createSession({ userId: user.id, token: 'retained-session' });
    await new D1UserRepository(s).saveContent(user.id, {
      contentType: 'STORY',
      contentId: 'saved-original',
      title: 'Original link',
      href: '/the-beat/saved-original',
      metadata: { attribution: 'original-source' },
    });
    for (const kind of ['front-office', 'saved-bet', 'application-config', 'editorial'])
      await docs.commit(user.id, kind, `${kind}-original`, 0, crypto.randomUUID(), {
        originalId: `${kind}-original`,
        progress: kind === 'front-office' ? 'x'.repeat(2100000) : 'retained',
      });
    for (let i = 0; i < 85; i++)
      await s.batch([
        s.statement(
          'INSERT INTO app_search(id,team_id,title,content,source_id,source_url) VALUES(?,?,?,?,?,?)',
          [
            `historical-${i}`,
            'KC',
            'Historical title',
            'historical evidence',
            'source',
            'https://example.invalid/original',
          ],
        ),
      ]);
    const bucket = await h.mf.getR2Bucket('EDITORIAL_ARCHIVE'),
      source: SnapshotObjects = {
        keys: async () => {
          let cursor: string | undefined;
          const result: string[] = [];
          do {
            const page = await bucket.list({ cursor });
            result.push(...page.objects.map((o) => o.key));
            cursor = page.truncated ? page.cursor : undefined;
          } while (cursor);
          return result;
        },
        get: async (k) => {
          const o = await bucket.get(k);
          return o ? new Uint8Array(await o.arrayBuffer()) : null;
        },
        putImmutable: async () => {
          throw Error('Source is frozen');
        },
      },
      restored = bucketObjects(
        (await target.mf.getR2Bucket('EDITORIAL_ARCHIVE')) as unknown as R2Bucket,
      ),
      backupObjects = bucketObjects(
        (await backupHarness.mf.getR2Bucket('EDITORIAL_BACKUP')) as unknown as R2Bucket,
      );
    await assert.rejects(
      checkpoint(h.binding as unknown as SqlDatabase, source, b, backupObjects, secret, 'ONLINE'),
    );
    await s.batch([
      s.statement("UPDATE content_control SET version=2,value_json=? WHERE key='writer_epoch'", [
        JSON.stringify({ epoch: 2 }),
      ]),
    ]);
    const copied = await checkpoint(
      h.binding as unknown as SqlDatabase,
      source,
      b,
      backupObjects,
      secret,
      'OFFLINE_WRITERS_STOPPED',
    );
    let chunks = 0;
    await assert.rejects(
      checkpoint(
        h.binding as unknown as SqlDatabase,
        { ...source, keys: async () => [] },
        b,
        backupObjects,
        secret,
        'OFFLINE_WRITERS_STOPPED',
      ),
      /D1 reference is missing/,
    );
    await assert.rejects(
      checkpoint(
        h.binding as unknown as SqlDatabase,
        { ...source, get: async () => new Uint8Array([0]) },
        b,
        backupObjects,
        secret,
        'OFFLINE_WRITERS_STOPPED',
      ),
      /Corrupt content-addressed/,
    );
    await assert.rejects(
      restore(
        target.binding as unknown as SqlDatabase,
        restored,
        b,
        backupObjects,
        secret,
        copied.id,
        'OFFLINE_WRITERS_STOPPED',
        () => {
          if (++chunks === 9) throw Error('Synthetic interruption');
        },
      ),
    );
    const result = await restore(
      target.binding as unknown as SqlDatabase,
      restored,
      b,
      backupObjects,
      secret,
      copied.id,
      'OFFLINE_WRITERS_STOPPED',
    );
    assert.equal(result.status, 'READY');
    const next = new Storage(target.binding as unknown as SqlDatabase, restored),
      auth = new D1AuthRepository(next);
    assert.equal((await auth.getCredential(user.id))?.password_hash, 'original-argon2-hash');
    assert.equal(
      (await next.rows<any>("SELECT version FROM content_control WHERE key='writer_epoch'"))[0]
        .version,
      2,
    );
    assert.equal(
      (
        await new ApplicationDocuments(next).read<{ originalId: string }>(
          user.id,
          'saved-bet',
          'saved-bet-original',
        )
      )?.value.originalId,
      'saved-bet-original',
    );
    assert(await auth.findSessionByToken('retained-session'));
    assert.equal(
      (
        await new ApplicationDocuments(next).read<{ progress: string }>(
          user.id,
          'front-office',
          'front-office-original',
        )
      )?.value.progress.length,
      2100000,
    );
    assert.equal(
      (await new D1UserRepository(next).listSavedContent(user.id))[0].contentId,
      'saved-original',
    );
    assert.equal((await lexicalSearch(next, 'historical', 'KC')).length, 20);
    await restore(
      target.binding as unknown as SqlDatabase,
      restored,
      b,
      backupObjects,
      secret,
      copied.id,
      'OFFLINE_WRITERS_STOPPED',
    );
    await assert.rejects(
      restore(
        target.binding as unknown as SqlDatabase,
        restored,
        b,
        backupObjects,
        'incorrect-secret-at-least-32-characters',
        copied.id,
        'OFFLINE_WRITERS_STOPPED',
      ),
    );
    await mkdir('../../reports/zero-cost-phase-3', { recursive: true });
    await writeFile(
      '../../reports/zero-cost-phase-3/cross-store-rehearsal.json',
      JSON.stringify(
        {
          scope:
            'MEASURED offline synthetic bindings; all logical D1 tables and frozen primary R2 namespace',
          backup: copied,
          restore: result,
          interruptAfterChunks: 9,
          productionRpo: 'UNVERIFIED',
          productionRto: 'UNVERIFIED',
        },
        null,
        2,
      ),
    );
  } finally {
    await Promise.all([h.close(), target.close(), backupHarness.close()]);
  }
});
