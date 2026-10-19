import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import {
  MultiD1,
  DATABASE_OWNERS,
  TEAM_GROUPS,
  teamDatabase,
  capacityStatus,
  collectCapacity,
} from '../../../packages/storage/multi-d1';
import { requestMetrics } from '../../../packages/storage/instrumentation';
import { D1AuthRepository } from '../../../packages/storage/auth';
import {
  withApplicationBindings,
  applicationStorage,
  applicationTeamStorage,
} from '../../../src/server/persistence/bindings';
import type { SqlDatabase } from '../../../packages/storage/core';
test('ten physical D1 databases: role schemas, 32-team routing, auth ownership, budget, restart', async () => {
  const directory = await mkdtemp('/private/tmp/dd-multi-routing-');
  const options = {
    name: 'multi-d1-local',
    modules: true,
    script: 'export default {fetch(){return new Response("isolated")}}',
    compatibilityDate: '2026-10-18',
    d1Databases: Object.fromEntries(DATABASE_OWNERS.map((o, i) => [o, `synthetic-multi-${i}`])),
    resourcePersistencePath: directory,
    outboundService: () => new Response('Network disabled', { status: 403 }),
    telemetry: { enabled: false },
  };
  let mf = new Miniflare(convertV4MiniflareOptions(options));
  try {
    const load = async () =>
      Object.fromEntries(
        await Promise.all(DATABASE_OWNERS.map(async (o) => [o, await mf.getD1Database(o)])),
      ) as Record<(typeof DATABASE_OWNERS)[number], SqlDatabase>;
    let bindings = await load();
    for (const owner of DATABASE_OWNERS) {
      const role = owner === 'D1_USERS' ? 'users' : owner === 'D1_SHARED' ? 'shared' : 'team';
      const schema = await readFile(
        new URL(`../../multi-d1/migrations/${role}/0001_role_bootstrap.sql`, import.meta.url),
        'utf8',
      );
      for (const sql of schema
        .replace(/^--.*$/gm, '')
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean))
        await bindings[owner].prepare(sql).run();
      await bindings[owner]
        .prepare('INSERT INTO app_storage_epoch(id,epoch,locked) VALUES(1,0,0)')
        .run();
      assert.deepEqual(
        (await bindings[owner].prepare('PRAGMA foreign_key_check').all()).results,
        [],
      );
      const names = (
        await bindings[owner]
          .prepare("SELECT name FROM sqlite_schema WHERE type='table'")
          .all<{ name: string }>()
      ).results.map((r) => r.name);
      assert.equal(names.includes('app_users'), owner === 'D1_USERS');
      assert.equal(names.includes('app_sportsbook_events'), owner === 'D1_SHARED');
      assert.equal(names.includes('app_editorial_stories'), owner !== 'D1_USERS');
      assert(!names.includes('content_candidates'));
    }
    const samples = await collectCapacity(bindings);
    assert.equal(samples.length, 10);
    assert(samples.every((s) => s.bytes > 0 && s.retentionBacklog === 0));
    assert.throws(() => new MultiD1({}), /Missing database/);
    assert.throws(
      () => new MultiD1(Object.fromEntries(DATABASE_OWNERS.map((o) => [o, bindings.D1_USERS]))),
      /distinct/,
    );
    const router = new MultiD1(bindings),
      user = await new D1AuthRepository(router.users()).createEmailUser({
        email: 'synthetic@example.invalid',
        passwordHash: 'existing-hash-unchanged',
      });
    assert(user);
    for (const teams of TEAM_GROUPS)
      for (const team of teams)
        await new MultiD1(bindings)
          .team(team)
          .statement(
            'INSERT INTO app_story_game_links(story_id,resolution_json,updated_at) VALUES(?,?,?)',
            [team, JSON.stringify({ team }), Date.now()],
          )
          .run();
    for (let i = 0; i < 8; i++)
      assert.deepEqual(
        (
          await bindings[`D1_TEAM_${i + 1}` as keyof typeof bindings]
            .prepare('SELECT story_id FROM app_story_game_links ORDER BY story_id')
            .all<{ story_id: string }>()
        ).results.map((r) => r.story_id),
        [...TEAM_GROUPS[i]].sort(),
      );
    assert.throws(() => teamDatabase('NFL'), /Unknown/);
    assert.throws(() => teamDatabase('kc'), /canonical/);
    await withApplicationBindings(
      {
        db: bindings.D1_USERS,
        objects: router.users().objects,
        multiD1: new MultiD1(bindings),
        env: { APP_DATA_BACKEND: 'd1' },
      },
      async () => {
        assert.throws(() => applicationStorage(), /declare/);
        assert.equal(
          (await new D1AuthRepository(applicationStorage('D1_USERS')).findUserById(user.id))
            ?.primary_email,
          'synthetic@example.invalid',
        );
        assert.equal(
          (
            await applicationTeamStorage('KC').rows(
              'SELECT story_id FROM app_story_game_links WHERE story_id=?',
              ['KC'],
            )
          ).length,
          1,
        );
      },
    );
    const metrics = requestMetrics(),
      limited = new MultiD1(bindings, metrics);
    await Promise.all(
      DATABASE_OWNERS.map((owner) =>
        limited
          .storage(owner)
          .db.batch(Array.from({ length: 4 }, () => limited.storage(owner).db.prepare('SELECT 1'))),
      ),
    );
    assert.equal(metrics.statements, 50);
    await assert.rejects(limited.shared().db.prepare('SELECT 1').all(), {
      name: 'QueryBudgetError',
    });
    assert.equal(
      [...limited.byOwner.values()].reduce((s, m) => s + m.statements, 0),
      50,
    );
    await mf.dispose();
    mf = new Miniflare(convertV4MiniflareOptions(options));
    bindings = await load();
    assert.equal(
      (await new D1AuthRepository(new MultiD1(bindings).users()).getCredential(user.id))
        ?.password_hash,
      'existing-hash-unchanged',
    );
    assert.equal(
      (
        await bindings.D1_TEAM_5.prepare('SELECT count(*) AS n FROM app_story_game_links').first<{
          n: number;
        }>()
      )?.n,
      4,
    );
    const report = new URL('../../../reports/multi-d1-implementation/', import.meta.url);
    await mkdir(report, { recursive: true });
    await writeFile(
      new URL('routing.json', report),
      JSON.stringify(
        {
          scope:
            'MEASURED synthetic local workerd D1; repository-level routing, not complete application qualification',
          physicalDatabases: 10,
          teams: 32,
          restart: true,
          schemas: samples,
          forcedBudgetStatements: metrics.statements,
          rejectedStatement: 51,
          perDatabase: [...limited.byOwner],
        },
        null,
        2,
      ) + '\n',
    );
  } finally {
    await mf.dispose();
    await rm(directory, { recursive: true, force: true });
  }
});
test('capacity warnings preserve real database and account limits', () => {
  const samples = DATABASE_OWNERS.map((owner) => ({
    owner,
    bytes: 100_000_000,
    payloadBytes: 0,
    retentionBacklog: 0,
    previousBytes: 99_000_000,
    elapsedDays: 2,
  }));
  samples[0].bytes = 350_000_000;
  samples[1].bytes = 450_000_000;
  samples[2].bytes = 500_000_000;
  const status = capacityStatus(samples, { reads: 3_500_000, writes: 100_000 });
  assert.equal(status.databases[0].level, 'WARNING');
  assert.equal(status.databases[1].level, 'CRITICAL');
  assert.equal(status.databases[2].level, 'LIMIT');
  assert(status.quotaExceeded);
  assert.equal(status.databases[3].dailyGrowthBytes, 500_000);
  assert.throws(() => capacityStatus(samples.slice(1), { reads: 0, writes: 0 }), /Complete/);
});
