import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { multiHarness } from '../test/multi-harness';
import { D1AuthRepository } from '../../../packages/storage/auth';
import { MultiD1 } from '../../../packages/storage/multi-d1';
test('owner CLI backs up and restores all ten local databases without remote credentials', async () => {
  const source = await multiHarness(true, undefined, true),
    target = await multiHarness(false, undefined, true);
  try {
    const user = await new D1AuthRepository(new MultiD1(source.db).users()).createEmailUser({
      email: 'offline-cli@example.invalid',
      passwordHash: 'original-cli-phc',
    });
    assert(user);
    await source.suspend();
    await target.suspend();
    const archive = source.directory + '/owner-encrypted.json';
    const root = fileURLToPath(new URL('../../../', import.meta.url));
    const env = Object.fromEntries(
      ['PATH', 'HOME', 'TMPDIR', 'SHELL', 'LANG', 'USER']
        .filter((k) => process.env[k])
        .map((k) => [k, process.env[k]!]),
    );
    Object.assign(env, {
      TSX_TSCONFIG_PATH: root + 'tsconfig.test.json',
      DD_OFFLINE_BACKUP_KEY: 'synthetic-cli-owner-key-at-least-32-characters',
    });
    assert(!('DATABASE_URL' in env));
    for (const [mode, dir] of [
      ['backup', source.directory],
      ['restore', target.directory],
    ]) {
      const result = spawnSync(
        process.execPath,
        [
          '--import',
          'tsx',
          'scripts/multi-d1-owner.ts',
          mode,
          '--local',
          dir,
          archive,
          'WRITERS_STOPPED',
        ],
        { cwd: root, env, encoding: 'utf8', timeout: 90000 },
      );
      assert.equal(result.status, 0, result.stdout + result.stderr);
      console.info(result.stdout.trim());
    }
    assert(!(await readFile(archive, 'utf8')).includes(user.primaryEmail));
    await target.restart();
    assert.equal(
      (
        await target.db.D1_USERS.prepare(
          'SELECT password_hash FROM app_credentials WHERE user_id=?',
        )
          .bind(user.id)
          .first<any>()
      )?.password_hash,
      'original-cli-phc',
    );
  } finally {
    await source.close();
    await target.close();
  }
});
test('transactional mail reserves private delivery limits atomically without sending real email', async () => {
  const { MailQueue } = await import('../../../packages/storage/mail');
  const h = await multiHarness();
  try {
    const user = await new D1AuthRepository(new MultiD1(h.db).users()).createEmailUser({
      email: 'mail-fixture@example.invalid',
      passwordHash: 'original-mail-phc',
    });
    assert(user);
    await new MailQueue(
      new MultiD1(h.db).users(),
      'synthetic-mail-key-at-least-32-characters',
    ).enqueue(user.id, 'TRANSACTIONAL', 'original-reset-request', {
      to: 'mail-fixture@example.invalid',
      subject: 'Synthetic',
      text: 'Synthetic recovery link',
    });
    const router = new MultiD1(h.db);
    let calls = 0;
    const result = await new MailQueue(
      router.users(),
      'synthetic-mail-key-at-least-32-characters',
    ).process(
      {
        name: 'local-fixture',
        dailyLimit: 100,
        monthlyLimit: 3000,
        idempotencyMs: 86400000,
        send: async (message, id) => {
          calls++;
          assert.equal(id, 'original-reset-request');
          return { id: 'synthetic-delivery-ack' };
        },
      },
      Date.now(),
      1,
    );
    assert.equal(result.sent, 1);
    assert.equal(calls, 1);
    assert(router.metrics.statements <= 50);
    console.info('PRIVATE_MAIL_METRICS', JSON.stringify(router.metrics));
    assert.equal(
      (await h.db.D1_SHARED.prepare('SELECT count(*) n FROM app_limits').first<any>())?.n,
      0,
    );
  } finally {
    await h.close();
  }
});
test('multi-D1 scheduler separates bounded service invocations even when every optional job is enabled', async () => {
  const { applicationWorker } = await import('../../application/index');
  const h = await multiHarness();
  const calls: string[] = [];
  try {
    const service = {
      fetch: async (request: Request) => {
        const url = new URL(request.url);
        calls.push(url.pathname + url.search);
        if (url.pathname.includes('/content/'))
          return Response.json({
            ok: true,
            owner: 'D1_TEAM_1',
            nextAction: 'poll',
            batch: '00000000-0000-0000-0000-000000000000',
          });
        if (url.pathname.includes('/three-and-out'))
          return Response.json(
            url.searchParams.get('action') === 'deliver'
              ? {
                  ok: true,
                  delivery: { generationRequired: { teamId: 'KC', briefingDate: '2026-10-19' } },
                }
              : { ok: true, done: false },
          );
        return Response.json({ ok: true, considered: 1, status: 'continued' });
      },
    };
    await applicationWorker.scheduled(
      { cron: '* * * * *', scheduledTime: Date.parse('2026-10-19T21:30:00Z') },
      {
        D1_USERS: h.db.D1_USERS,
        D1_SHARED: h.db.D1_SHARED,
        APP_OBJECT_BACKEND: 'd1',
        APP_CONTENT_ENABLED: 'true',
        APP_BRIEFINGS_ENABLED: 'true',
        APP_ODDS_FETCH_ENABLED: 'true',
        APP_ODDS_PROCESSING_ENABLED: 'true',
        APP_MAIL_ENABLED: 'true',
        CONTENT_AUTOMATION_SECRET: 'synthetic-content-secret-at-least-32',
        APP_MAIL_JOB_SECRET: 'synthetic-mail-secret-at-least-32',
        API_SERVICE: service,
        ODDS_PROCESSOR: {
          fetch: async () => {
            calls.push('/process');
            return Response.json({ status: 'done' });
          },
        },
      } as any,
    );
    assert.equal(calls.length, 47);
    assert(calls.filter((p) => p.includes('/content/')).length === 32);
    assert(calls.filter((p) => p.includes('/email')).length === 4);
    console.info('BACKGROUND_SERVICE_CALLS', calls.length);
  } finally {
    await h.close();
  }
});
