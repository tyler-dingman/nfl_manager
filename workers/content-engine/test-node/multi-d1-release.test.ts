import { sealErasureLedger } from '../../../scripts/erasure-ledger';
import { maintainMultiD1 } from '../../../scripts/maintain-multi-d1';
import { readFile, writeFile } from 'node:fs/promises';
import {
  saveCrossShardContent,
  verifyCrossShardReferences,
} from '../../../packages/storage/cross-shard-saves';
import { D1UserWorkflows } from '../../../packages/storage/user-workflows';
import { D1EditorialIngestion } from '../../../packages/storage/editorial-ingestion';
import {
  advanceEditorialHandoff,
  stageEditorialHandoff,
} from '../../../packages/storage/editorial-handoffs';
import { processSource, workOne } from '../../../src/server/story-engine/service';
import { GroundedDeterministicStorySynthesizer } from '../../../src/features/story-engine/synthesis';
import test from 'node:test';
import assert from 'node:assert/strict';
import { multiHarness, splitSql } from '../test/multi-harness';
import { MultiD1, DATABASE_OWNERS, TEAM_GROUPS } from '../../../packages/storage/multi-d1';
import { EditorialDirectory } from '../../../packages/storage/editorial-directory';
import { D1AuthRepository } from '../../../packages/storage/auth';
import { backupDatabases, restoreDatabases } from '../../../scripts/multi-d1-recovery';
import {
  withApplicationBindings,
  withEditorialOwner,
  applicationStorage,
} from '../../../src/server/persistence/bindings';
import { PublicEditorial } from '../../../packages/storage/editorial';
import { getPublicStoryById } from '../../../src/server/story-engine/projections';
test('all 32 public story IDs resolve without shard parameters and survive directory interruption/restart', async () => {
  const h = await multiHarness();
  try {
    for (const team of TEAM_GROUPS.flat()) {
      const router = new MultiD1(h.db),
        s = router.team(team),
        id = `original-${team}`;
      const view = {
        id,
        teamId: team,
        headline: `${team} original; headline`,
        shortSummary: 'Attributed original',
        whatHappened: 'Original evidence',
        whyItMatters: 'Matters',
        whatsNext: 'Next',
        status: 'DEVELOPING',
        storyType: 'ANALYSIS',
        importanceScore: 80,
        confidenceScore: 95,
        firstReportedAt: new Date().toISOString(),
        lastMeaningfulUpdateAt: new Date().toISOString(),
        sources: [
          {
            id: 'source',
            name: 'Original',
            url: 'https://example.invalid/source',
            publishedAt: new Date().toISOString(),
            official: true,
            original: true,
          },
        ],
        version: 1,
        sourceItemCount: 1,
        publisherCount: 1,
        independentSourceCount: 1,
        hotReadUntil: null,
        clusterReason: 'Original',
      };
      await new PublicEditorial(s).publish(view as any, 'AUTO_PUBLISHED');
    }
    await h.restart();
    for (const team of TEAM_GROUPS.flat()) {
      const router = new MultiD1(h.db);
      await withApplicationBindings(
        {
          db: h.db.D1_USERS,
          objects: router.users().objects,
          multiD1: router,
          env: { APP_DATA_BACKEND: 'd1' },
        },
        async () => {
          assert.equal((await getPublicStoryById(`original-${team}`))?.teamId, team);
          assert(router.metrics.statements <= 50);
          await withEditorialOwner(
            `D1_TEAM_${TEAM_GROUPS.findIndex((t) => (t as readonly string[]).includes(team)) + 1}` as any,
            async () => {
              assert.equal(applicationStorage(), router.team(team));
            },
          );
        },
      );
    }
    assert.equal(await new EditorialDirectory(new MultiD1(h.db)).resolve('public', 'absent'), null);
    const users = new MultiD1(h.db).users(),
      one = await new D1AuthRepository(users).createEmailUser({
        email: 'one@example.invalid',
        passwordHash: 'original',
      }),
      two = await new D1AuthRepository(new MultiD1(h.db).users()).createEmailUser({
        email: 'two@example.invalid',
        passwordHash: 'original',
      });
    assert(one && two);
    for (const team of ['KC', 'DAL']) {
      const router = new MultiD1(h.db);
      const saved = await saveCrossShardContent(router, one.id, {
        contentType: 'STORY',
        contentId: `original-${team}`,
        title: 'Original',
        metadata: { owner: 'D1_TEAM_8' },
      });
      assert(saved);
      assert(router.metrics.statements <= 50);
    }
    await h.restart();
    await verifyCrossShardReferences(h.db);
    assert.equal(
      (await new D1UserWorkflows(new MultiD1(h.db).users()).listSavedContent(one.id)).length,
      2,
    );
    assert.equal(
      (await new D1UserWorkflows(new MultiD1(h.db).users()).listSavedContent(two.id)).length,
      0,
    );
    const orphan = await new MultiD1(h.db)
      .team('KC')
      .put({ orphan: 'verified redundant synthetic object' });
    const maintenance = await maintainMultiD1(
      h.db,
      'synthetic-owner-backup-key-at-least-32-characters',
      {
        rawWritersStopped: true,
        now: Date.now(),
        persistAndReadBack: async (archive) => {
          const path = h.directory + '/encrypted-archive.json';
          await writeFile(path, JSON.stringify(archive), { mode: 0o600 });
          return { path, archive: JSON.parse(await readFile(path, 'utf8')) };
        },
      },
    );
    assert.equal(maintenance.length, 10);
    await verifyCrossShardReferences(h.db);
    assert.equal(
      await h.db.D1_TEAM_1.prepare('SELECT hash FROM app_payload_objects WHERE hash=?')
        .bind(orphan)
        .first(),
      null,
    );
    const target = await multiHarness(false),
      secret = 'synthetic-saved-reference-restore-key-at-least-32';
    try {
      const archive = await backupDatabases(h.db, secret, {
        rawWritersStopped: true,
        verifyReferences: verifyCrossShardReferences,
      });
      await restoreDatabases(archive, secret, target.db, {
        currentErasureLedger: await sealErasureLedger(h.db.D1_USERS, secret),
        isolatedEmptyTargets: true,
        execute: async (owner, sql) => {
          for (const statement of splitSql(sql)) await target.db[owner].prepare(statement).run();
        },
        verifyReferences: verifyCrossShardReferences,
      });
      await target.restart();
      await verifyCrossShardReferences(target.db);
      assert.equal(
        (await new D1UserWorkflows(new MultiD1(target.db).users()).listSavedContent(one.id)).length,
        2,
      );
      for (const team of ['KC', 'DAL'])
        assert.equal(
          (await new PublicEditorial(new MultiD1(target.db).team(team)).get('original-' + team))
            ?.id,
          'original-' + team,
        );
    } finally {
      await target.close();
    }
  } finally {
    await h.close();
  }
});
test('coordinated encrypted ten-database recovery rejects missing/corrupt inputs and restores original private IDs', async () => {
  const source = await multiHarness(),
    target = await multiHarness(false),
    interrupted = await multiHarness(false);
  const secret = 'synthetic-offline-release-key-at-least-32-characters';
  try {
    const router = new MultiD1(source.db),
      user = await new D1AuthRepository(router.users()).createEmailUser({
        email: 'restore@example.invalid',
        passwordHash: 'original-phc',
      });
    assert(user);
    await source.db.D1_USERS.prepare(
      "INSERT INTO app_saved_content(id,user_id,content_type,content_id,title,metadata_json,created_at) VALUES('original-save',?,'STORY','original-KC','Original','{}',1)",
    )
      .bind(user.id)
      .run();
    await source.db.D1_TEAM_1.prepare(
      "INSERT INTO app_story_game_links(story_id,resolution_json,updated_at) VALUES('original-KC','{}',1)",
    ).run();
    const verify = async (db: typeof source.db) => {
      const saved = await db.D1_USERS.prepare(
        "SELECT content_id FROM app_saved_content WHERE id='original-save'",
      ).first<{ content_id: string }>();
      assert(saved);
      assert(
        await db.D1_TEAM_1.prepare('SELECT story_id FROM app_story_game_links WHERE story_id=?')
          .bind(saved.content_id)
          .first(),
      );
    };
    await source.db.D1_USERS.prepare(
      "UPDATE app_settings SET preferences_json='{" +
        '\"preferredTeamId\":\"KC\",\"reducedMotion\":true' +
        "}' WHERE user_id=?",
    )
      .bind(user.id)
      .run();
    const fo = await new MultiD1(source.db).users().put({
      schema: 1,
      originalId: 'original-franchise',
      progress: { season: 2026, week: 8 },
      owner: user.id,
    });
    await source.db.D1_USERS.prepare(
      "INSERT INTO app_franchise_heads(user_id,save_id,team_abbr,season,phase,version,object_hash,created_at,updated_at) VALUES(?,'original-franchise','KC',2026,'REGULAR_SEASON',8,?,1,1)",
    )
      .bind(user.id, fo)
      .run();
    const archive = await backupDatabases(source.db, secret, {
      rawWritersStopped: true,
      verifyReferences: verify,
    });
    for (const owner of DATABASE_OWNERS)
      assert.equal(
        (
          await source.db[owner]
            .prepare('SELECT locked FROM app_storage_epoch WHERE id=1')
            .first<any>()
        )?.locked,
        0,
      );
    const execute = async (owner: any, sql: string) => {
      for (const statement of splitSql(sql))
        await target.db[owner as keyof typeof target.db].prepare(statement).run();
    };
    const corrupt = structuredClone(archive);
    delete corrupt.shards.D1_TEAM_1;
    await assert.rejects(
      restoreDatabases(corrupt, secret, target.db, {
        currentErasureLedger: await sealErasureLedger(source.db.D1_USERS, secret),
        isolatedEmptyTargets: true,
        execute,
        verifyReferences: verify,
      }),
      /manifest|Missing/,
    );
    const tampered = structuredClone(archive);
    (tampered.shards.D1_TEAM_1 as any).cipher =
      'AAAA' + (tampered.shards.D1_TEAM_1 as any).cipher.slice(4);
    await assert.rejects(
      restoreDatabases(tampered, secret, target.db, {
        currentErasureLedger: await sealErasureLedger(source.db.D1_USERS, secret),
        isolatedEmptyTargets: true,
        execute,
        verifyReferences: verify,
      }),
    );
    assert.equal(
      (
        await target.db.D1_USERS.prepare(
          "SELECT name FROM sqlite_schema WHERE type='table' AND name='app_users'",
        ).all()
      ).results.length,
      0,
    );
    await assert.rejects(
      backupDatabases(source.db, secret, {
        rawWritersStopped: true,
        verifyReferences: async () => {
          throw Error('Interrupted backup');
        },
      }),
      /Interrupted backup/,
    );
    for (const owner of DATABASE_OWNERS)
      assert.equal(
        (
          await source.db[owner]
            .prepare('SELECT locked FROM app_storage_epoch WHERE id=1')
            .first<any>()
        )?.locked,
        0,
      );
    let calls = 0;
    await assert.rejects(
      restoreDatabases(archive, secret, interrupted.db, {
        currentErasureLedger: await sealErasureLedger(source.db.D1_USERS, secret),
        isolatedEmptyTargets: true,
        execute: async (owner, sql) => {
          if (++calls === 2) throw Error('Interrupted restore');
          for (const statement of splitSql(sql))
            await interrupted.db[owner].prepare(statement).run();
        },
        verifyReferences: verify,
      }),
      /Interrupted restore/,
    );
    assert.equal(
      (
        await interrupted.db.D1_TEAM_1.prepare(
          'SELECT locked FROM app_storage_epoch WHERE id=1',
        ).first<any>()
      )?.locked,
      1,
    );
    const result = await restoreDatabases(archive, secret, target.db, {
      currentErasureLedger: await sealErasureLedger(source.db.D1_USERS, secret),
      isolatedEmptyTargets: true,
      execute,
      verifyReferences: verify,
    });
    assert.equal(result.atomicSnapshot, false);
    assert.equal(
      (
        await target.db.D1_USERS.prepare(
          'SELECT password_hash FROM app_credentials WHERE user_id=?',
        )
          .bind(user.id)
          .first<any>()
      )?.password_hash,
      'original-phc',
    );
    await target.restart();
    await verify(target.db);
    assert.equal(
      (
        await target.db.D1_USERS.prepare(
          'SELECT preferences_json FROM app_settings WHERE user_id=?',
        )
          .bind(user.id)
          .first<any>()
      )?.preferences_json,
      JSON.stringify({ preferredTeamId: 'KC', reducedMotion: true }),
    );
    const restoredFo = await target.db.D1_USERS.prepare(
      'SELECT object_hash,version FROM app_franchise_heads WHERE user_id=? AND save_id=?',
    )
      .bind(user.id, 'original-franchise')
      .first<any>();
    assert.equal(restoredFo?.version, 8);
    assert.equal(restoredFo?.object_hash, fo);
    assert.equal((await new MultiD1(target.db).users().get<any>(fo)).progress.week, 8);
  } finally {
    await source.close();
    await target.close();
    await interrupted.close();
  }
});

test('cross-team ingestion uses a durable phased handoff without relocating original source checkpoints', async () => {
  const h = await multiHarness();
  const source: any = {
    id: 'original-kc-source',
    name: 'Original reporter',
    sourceType: 'OFFICIAL_TEAM',
    teamId: 'KC',
    leagueWide: false,
    url: 'https://example.invalid',
    feedUrl: 'https://example.invalid/rss',
    fetchStrategy: 'RSS',
    pollingTier: 'C',
    priority: 100,
    reliabilityScore: 1,
    checkIntervalSeconds: 300,
    enabled: true,
    etag: null,
    lastModified: null,
    lastCheckedAt: null,
    lastSuccessfulAt: null,
    nextCheckAt: new Date(0),
    failureCount: 0,
    lastError: null,
    metadata: { publishAll: true },
  };
  const scoped = async (owner: any, fn: (router: MultiD1) => Promise<any>) => {
    const router = new MultiD1(h.db);
    const result = await withApplicationBindings(
      {
        db: h.db.D1_USERS,
        objects: router.users().objects,
        multiD1: router,
        env: { APP_DATA_BACKEND: 'd1', OBSERVER_MODE: 'true' },
      },
      () => withEditorialOwner(owner, () => fn(router)),
    );
    assert(router.metrics.statements <= 50);
    return result;
  };
  try {
    await scoped('D1_TEAM_1', (r) => new D1EditorialIngestion(r.team('KC')).syncSource(source));
    const now = new Date().toISOString(),
      item = {
        sourceId: source.id,
        externalId: 'original-provider-item',
        url: 'https://example.invalid/buffalo-original',
        title: 'Buffalo Bills sign a new wide receiver for roster depth',
        author: 'Original reporter',
        publishedAt: now,
        updatedAt: null,
        rawText:
          'The Buffalo Bills announced the signing of a wide receiver to improve roster depth. The team confirmed the transaction and will evaluate the new player in practice.',
        excerpt: 'The Buffalo Bills announced a new wide receiver signing.',
        media: [],
        fetchedAt: now,
      };
    await scoped('D1_TEAM_1', () =>
      processSource(
        source,
        {
          fetch: async () => ({
            items: [item],
            notModified: false,
            etag: 'original-validator',
            lastModified: null,
          }),
        },
        { deferCheckpoint: true },
      ),
    );
    assert.equal(
      (await h.db.D1_TEAM_1.prepare('SELECT count(*) n FROM app_editorial_candidates').first<any>())
        ?.n,
      0,
    );
    await scoped('D1_TEAM_1', (r) => advanceEditorialHandoff(r, 'D1_TEAM_1'));
    await h.restart();
    await scoped('D1_TEAM_1', (r) => advanceEditorialHandoff(r, 'D1_TEAM_1'));
    await scoped('D1_TEAM_1', (r) => advanceEditorialHandoff(r, 'D1_TEAM_1'));
    const job = await scoped('D1_TEAM_5', () =>
      workOne('release-test', undefined, new GroundedDeterministicStorySynthesizer()),
    );
    assert(job);
    const story = await h.db.D1_TEAM_5.prepare(
      'SELECT id,team_id FROM app_editorial_stories',
    ).first<any>();
    assert(story);
    assert.equal(story.team_id, 'BUF');
    assert.equal(
      (await h.db.D1_TEAM_1.prepare('SELECT count(*) n FROM app_editorial_stories').first<any>())
        ?.n,
      0,
    );
    assert.equal(
      (
        await h.db.D1_TEAM_5.prepare('SELECT enabled FROM app_editorial_sources WHERE id=?')
          .bind(source.id)
          .first<any>()
      )?.enabled,
      0,
    );
    await scoped('D1_TEAM_1', () =>
      processSource(
        source,
        {
          fetch: async () => ({
            items: [item],
            notModified: false,
            etag: 'original-validator',
            lastModified: null,
          }),
        },
        { deferCheckpoint: true },
      ),
    );
    assert.equal(
      (await h.db.D1_TEAM_1.prepare('SELECT count(*) n FROM app_editorial_handoffs').first<any>())
        ?.n,
      1,
    );
    const second = { ...source, id: 'second-original-source' };
    await scoped('D1_TEAM_1', (r) => new D1EditorialIngestion(r.team('KC')).syncSource(second));
    const original = await new D1EditorialIngestion(new MultiD1(h.db).team('BUF')).candidateById(
      (await h.db.D1_TEAM_5.prepare('SELECT id FROM app_editorial_candidates').first<any>())!.id,
    );
    assert(original);
    await scoped('D1_TEAM_1', (r) =>
      stageEditorialHandoff(
        r,
        'D1_TEAM_1',
        {
          ...original,
          id: crypto.randomUUID(),
          sourceId: second.id,
          externalId: 'second-original-item',
        },
        second,
      ),
    );
    for (let phase = 0; phase < 3; phase++)
      await scoped('D1_TEAM_1', (r) => advanceEditorialHandoff(r, 'D1_TEAM_1'));
    const duplicate = await h.db.D1_TEAM_1.prepare(
      'SELECT status,object_hash FROM app_editorial_handoffs WHERE source_id=?',
    )
      .bind(second.id)
      .first<any>();
    assert.equal(duplicate?.status, 'DONE');
    assert(duplicate.object_hash);
    assert.equal(
      (await h.db.D1_TEAM_5.prepare('SELECT count(*) n FROM app_editorial_stories').first<any>())
        ?.n,
      1,
    );
  } finally {
    await h.close();
  }
});
