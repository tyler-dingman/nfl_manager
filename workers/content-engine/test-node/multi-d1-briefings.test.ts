import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { multiHarness } from '../test/multi-harness';
import { MultiD1 } from '../../../packages/storage/multi-d1';
import { PublicEditorial } from '../../../packages/storage/editorial';
import { D1AuthRepository } from '../../../packages/storage/auth';
import { withApplicationBindings } from '../../../src/server/persistence/bindings';
import { POST } from '../../../src/app/api/automation/three-and-out/route';
import { deliverDueDailyThreeAndOut } from '../../../src/server/three-and-out/daily-service';
test('Three & Out generation advances all 32 teams one invocation at a time and delivery reads the team owner', async () => {
  const h = await multiHarness();
  const now = new Date();
  let max = 0;
  const run = async <T>(fn: () => Promise<T>) => {
    const r = new MultiD1(h.db);
    try {
      return await withApplicationBindings(
        {
          db: h.db.D1_USERS,
          objects: r.users().objects,
          multiD1: r,
          env: { APP_DATA_BACKEND: 'd1', CONTENT_AUTOMATION_SECRET: 'synthetic-briefing-secret' },
        },
        fn,
      );
    } finally {
      max = Math.max(max, r.metrics.statements);
      assert(r.metrics.statements <= 50);
    }
  };
  try {
    for (const team of ['KC', 'DAL'])
      for (let i = 0; i < 3; i++) {
        const sources = [
          {
            id: 'original-source',
            name: 'Original official source',
            url: 'https://example.invalid/source',
            publishedAt: now.toISOString(),
            official: true,
            original: true,
          },
        ];
        const headline =
          team +
          ' ' +
          [
            'completes major roster transaction',
            'confirms quarterback injury update',
            'prepares for divisional game',
          ][i];
        await new PublicEditorial(new MultiD1(h.db).team(team)).publish(
          {
            id: `original-${team}-${i}`,
            teamId: team,
            storyType: ['TRANSACTION', 'INJURY', 'GAME_PREVIEW'][i],
            headline,
            shortSummary: headline + ' confirmed by the team.',
            whatHappened: headline + ' with source attribution.',
            whyItMatters: 'This changes the team outlook.',
            whatsNext: 'Watch the next team announcement.',
            status: 'CONFIRMED',
            importanceScore: 95 - i * 5,
            confidenceScore: 95,
            firstReportedAt: now.toISOString(),
            lastMeaningfulUpdateAt: now.toISOString(),
            sources,
            primarySource: sources[0],
            version: 1,
            sourceItemCount: 1,
            publisherCount: 1,
            independentSourceCount: 1,
          } as any,
          'PUBLISHED',
        );
      }
    const visited = [];
    for (let i = 0; i < 32; i++) {
      const response = await run(() =>
        POST(
          new NextRequest(
            'http://localhost/api/automation/three-and-out?action=generate&force=true',
            { method: 'POST', headers: { authorization: 'Bearer synthetic-briefing-secret' } },
          ),
        ),
      );
      assert.equal(response.status, 200);
      const body: any = await response.json();
      visited.push(body.generated[0].teamId);
      if (['KC', 'DAL'].includes(body.generated[0].teamId))
        assert.equal(body.generated[0].generated, true);
    }
    assert.equal(new Set(visited).size, 32);
    assert.equal(
      (await h.db.D1_TEAM_1.prepare('SELECT count(*) n FROM app_daily_briefings').first<any>())?.n,
      1,
    );
    assert.equal(
      (await h.db.D1_TEAM_2.prepare('SELECT count(*) n FROM app_daily_briefings').first<any>())?.n,
      1,
    );
    const user = await new D1AuthRepository(new MultiD1(h.db).users()).createEmailUser({
      email: 'briefing-owner@example.invalid',
      passwordHash: 'original-phc',
    });
    assert(user);
    await h.db.D1_USERS.prepare("UPDATE app_users SET status='ACTIVE' WHERE id=?")
      .bind(user.id)
      .run();
    await h.db.D1_USERS.prepare('UPDATE app_settings SET preferences_json=? WHERE user_id=?')
      .bind(JSON.stringify({ preferredTeamId: 'KC', pushEnabled: true }), user.id)
      .run();
    for (const channel of ['IN_APP', 'PUSH'])
      await h.db.D1_USERS.prepare(
        "INSERT INTO app_notification_preferences(id,user_id,category,channel,enabled,delivery_timezone,delivery_time,created_at) VALUES(?,?,'THREE_AND_OUT_DAILY',?,1,'UTC','00:00',?)",
      )
        .bind(crypto.randomUUID(), user.id, channel, now.getTime())
        .run();
    const result: any = await run(() => deliverDueDailyThreeAndOut(now));
    assert.equal(result.skipped, 1);
    assert.equal(result.generationRequired, undefined);
    const idle: any = await run(() => deliverDueDailyThreeAndOut(now));
    assert.equal(idle.idle, true);
    assert.equal(
      (
        await h.db.D1_USERS.prepare(
          "SELECT count(*) n FROM sqlite_schema WHERE name='app_daily_briefings'",
        ).first<any>()
      )?.n,
      0,
    );
    console.info('MULTI_D1_BRIEFING_MAXIMUM', max);
  } finally {
    await h.close();
  }
});
