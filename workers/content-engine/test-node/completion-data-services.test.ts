import { scheduledApplicationOdds } from '../../application/odds';
import { processOddsPublication } from '../../application/odds-processing';
import { instrumentDatabase, requestMetrics } from '../../../packages/storage/instrumentation';
import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { harness } from '../test/harness';
import { Storage, type SqlDatabase } from '../../../packages/storage/core';
import { PrivateObjects, type Bucket } from '../../../packages/storage/objects';
import { ReferenceData } from '../../../packages/storage/reference';
import { D1OddsBoard } from '../../../packages/storage/odds-board';
import { PrecomputedProps } from '../../../packages/storage/parlay-scores';
import { D1AuthRepository } from '../../../packages/storage/auth';
import { D1Rewards } from '../../../packages/storage/rewards';
import { PublicEditorial } from '../../../packages/storage/editorial';
import { lexicalSearch } from '../../../packages/storage/ai';
import { withApplicationBindings } from '../../../src/server/persistence/bindings';
import {
  getTrendingProps,
  computeTrendingProps,
} from '../../../src/server/historical-stats/trending-props-service';
import { LAB_SCORE_CONFIG } from '../../../packages/parlay/lab-score-config';
import { GET as marketsRoute } from '../../../src/app/api/parlay-lab/events/[eventId]/markets/route';
import {
  getDailyThreeAndOut,
  generateDailyThreeAndOut,
} from '../../../src/server/three-and-out/daily-service';
import {
  selectPrimarySource,
  type StoryView,
} from '../../../src/features/story-engine/public-story';
import { fanoutBriefingMail } from '../../application/briefing-mail';
import { createD1EmailSignup } from '../../../src/server/auth/d1-mail';
import { MailQueue, ResendEmailProvider } from '../../../packages/storage/mail';
const store = async (h: Awaited<ReturnType<typeof harness>>) =>
  new Storage(
    h.binding as unknown as SqlDatabase,
    new PrivateObjects((await h.mf.getR2Bucket('EDITORIAL_ARCHIVE')) as unknown as Bucket),
  );
const fixture = () => ({
  eventID: 'original-provider-event',
  season: 2026,
  week: 9,
  status: { startsAt: '2026-11-01T21:00:00.000Z' },
  teams: { home: { teamID: 'KC' }, away: { teamID: 'DEN' } },
  players: { PATRICK_MAHOMES_1_NFL: { name: 'Patrick Mahomes', teamID: 'KC', position: 'QB' } },
  odds: {
    passing: {
      oddID: 'passingYards-PATRICK_MAHOMES_1_NFL-game-ou-over',
      statID: 'passingYards',
      statEntityID: 'PATRICK_MAHOMES_1_NFL',
      periodID: 'game',
      betTypeID: 'ou',
      sideID: 'over',
      byBookmaker: {
        fanduel: {
          odds: -110,
          overUnder: 259.5,
          available: true,
          deeplink: 'https://example.invalid/fd',
        },
        draftkings: {
          odds: -115,
          overUnder: 259.5,
          available: true,
          deeplink: 'https://example.invalid/dk',
          altLines: [{ odds: 130, overUnder: 299.5, available: true }],
        },
      },
    },
  },
});
test('Parlay board, alt lines, real scoring and API reads run on D1/R2; original IDs and source-bound precomputes survive refresh', async () => {
  const h = await harness();
  try {
    const s = await store(h),
      board = new D1OddsBoard(s),
      refs = new ReferenceData(s),
      event = fixture(),
      asOf = Date.parse('2026-10-19T15:00:00Z');
    const id = await board.publishProvider(event, asOf),
      rows = await board.markets(id);
    assert(rows.some((r) => r.sportsbook === 'FANDUEL'));
    assert(rows.some((r) => r.isAltLine));
    assert(rows.every((r) => r.lineType));
    const player = rows.find((r) => r.playerId)!.playerId;
    const games = Array.from({ length: 8 }, (_, i) => ({
      gameId: `original-game-${i}`,
      date: `2025-10-${String(1 + i).padStart(2, '0')}`,
      kickoffAt: `2025-10-${String(1 + i).padStart(2, '0')}T20:00:00Z`,
      season: 2025,
      week: i + 1,
      seasonType: 'REG',
      playerId: player,
      playerName: 'Patrick Mahomes',
      teamId: 'KC',
      opponentTeamId: 'DEN',
      homeTeamId: 'KC',
      homeAway: 'HOME',
      position: 'QB',
      passingAttempts: 34,
      passingCompletions: 25,
      passingYards: 270 + i,
      passingTds: 2,
      interceptions: 0,
      carries: 4,
      rushingYards: 25,
      rushingTds: 0,
      targets: null,
      receptions: null,
      receivingYards: null,
      receivingTds: null,
    }));
    await refs.put('PLAYER_GAMES', player + ':2025', player, 2025, games, {
      position: 'QB',
      teams: ['KC'],
    });
    await refs.put('OPPONENT_GAMES', 'DEN:QB:2025', 'DEN:QB', 2025, games);
    const bindings = {
      db: s.db,
      objects: s.objects,
      env: {
        APP_DATA_BACKEND: 'd1',
        DATABASE_URL: '',
        APP_RUNTIME: 'node',
        APP_EDITORIAL_EMAIL_ENABLED: 'true',
      },
    };
    await withApplicationBindings(bindings, async () => {
      const opponents = { KC: 'DEN', DEN: 'KC' },
        teams = { homeTeamId: 'KC', awayTeamId: 'DEN' },
        scores = new PrecomputedProps(s),
        source = await scores.sources(id),
        computed = await computeTrendingProps(id, opponents, 2026, teams, 'all');
      assert(computed.length > 0);
      assert(computed.some((m) => m.trend));
      await scores.publish(id, LAB_SCORE_CONFIG.version, opponents, 2026, teams, source, computed);
      assert.deepEqual(await getTrendingProps(id, opponents, 2026, teams, 'all'), computed);
      const response = await marketsRoute(
        new NextRequest('http://localhost/api/parlay-lab/events/' + id + '/markets'),
        { params: Promise.resolve({ eventId: id }) },
      );
      assert.equal(response.status, 200);
      assert((await response.json()).markets.length > 0);
      await refs.put('PLAYER_GAMES', player + ':2025', player, 2025, games, {
        position: 'QB',
        teams: ['KC'],
      });
      assert.deepEqual(
        await scores.read(id, LAB_SCORE_CONFIG.version, opponents, 2026, teams),
        computed,
        'Unchanged reference imports must retain valid scores',
      );
      await refs.put(
        'PLAYER_GAMES',
        player + ':2025',
        player,
        2025,
        games.map((g, i) => (i === 0 ? { ...g, passingYards: g.passingYards + 1 } : g)),
        { position: 'QB', teams: ['KC'] },
      );
      assert.equal(await scores.read(id, LAB_SCORE_CONFIG.version, opponents, 2026, teams), null);
    });
    assert.equal(
      (await s.rows('SELECT * FROM app_sportsbook_market_ids')).length,
      0,
      'New identity directories belong in R2',
    );
    const originalIds = rows.map((r) => r.id),
      updated = fixture();
    updated.odds.passing.byBookmaker.fanduel.odds = -120;
    assert.equal(await board.publishProvider(updated, asOf + 86400000), id);
    assert.deepEqual(
      (await board.markets(id)).map((r) => r.id),
      originalIds,
    );
    const temporarilyMissing = fixture();
    temporarilyMissing.odds = {} as any;
    await board.publishProvider(temporarilyMissing, asOf + 2 * 86400000);
    assert.equal((await board.markets(id)).length, 0);
    await board.publishProvider(updated, asOf + 3 * 86400000);
    assert.deepEqual(
      (await board.markets(id)).map((r) => r.id),
      originalIds,
      'Reappearing markets retain original IDs',
    );
    assert.equal((await board.priceHistory(id, '2026-12-01T00:00:00Z')).length > 0, true);
    await assert.rejects(board.publishProvider(event, asOf), /superseded/);
    await assert.rejects(
      board.publish(
        {
          providerEventId: event.eventID,
          season: 2026,
          week: 9,
          homeTeamId: 'KC',
          awayTeamId: 'DEN',
          kickoffAt: new Date('2026-11-01T21:00:00Z'),
          status: 'scheduled',
        },
        [{ id: originalIds[0], normalizedKey: 'oversize-original', opaque: 'x'.repeat(4_000_000) }],
        asOf + 4 * 86400000,
      ),
      /JSON tree limit/,
    );
    assert.deepEqual(
      (await board.markets(id)).map((r) => r.id),
      originalIds,
      'Oversized normalization must leave the verified prior board intact',
    );

    assert.equal((await s.rows('PRAGMA foreign_key_check')).length, 0);
  } finally {
    await h.close();
  }
});
test('D1 reward dashboard, concurrent claims and redemption preserve account ownership', async () => {
  const h = await harness();
  try {
    const s = await store(h),
      auth = new D1AuthRepository(s),
      a = (await auth.createEmailUser({
        email: 'reward-a@example.invalid',
        passwordHash: 'original',
      }))!,
      b = (await auth.createEmailUser({
        email: 'reward-b@example.invalid',
        passwordHash: 'original',
      }))!,
      rewards = new D1Rewards(s);
    await s
      .statement('INSERT INTO app_reward_accounts(user_id,lifetime_yards) VALUES(?,50)', [a.id])
      .run();
    const dashboard = await rewards.dashboard(a.id);
    assert.equal(dashboard.rewards[0].status, 'AVAILABLE');
    assert.equal(dashboard.stats.crewRankingAvailable, false);
    const claims = await Promise.all([
      rewards.claim(a.id, 'yards-50'),
      rewards.claim(a.id, 'yards-50'),
    ]);
    assert.equal(claims[0].couponCode, claims[1].couponCode);
    await assert.rejects(rewards.claim(b.id, 'yards-50'));
    await assert.rejects(rewards.redeem(b.id, claims[0].couponCode!));
    await rewards.redeem(a.id, claims[0].couponCode!);
    await assert.rejects(rewards.redeem(a.id, claims[0].couponCode!));
    assert.equal((await rewards.dashboard(a.id)).rewards[0].status, 'REDEEMED');
  } finally {
    await h.close();
  }
});
test('editorial IDs, source attribution, lexical search, Three & Out and queued email run without PostgreSQL', async () => {
  const h = await harness();
  try {
    const s = await store(h),
      editorial = new PublicEditorial(s),
      now = new Date('2026-10-18T20:00:00Z');
    const sources = [
      {
        id: 'original-evidence',
        name: 'Original official source',
        url: 'https://example.invalid/source',
        publishedAt: now.toISOString(),
        official: true,
        original: true,
      },
    ];
    const titles = [
      'Chiefs complete major roster transaction',
      'Chiefs confirm quarterback injury update',
      'Chiefs prepare for divisional game',
    ];
    const stories: StoryView[] = titles.map((headline, i) => ({
      id: `original-story-${i}`,
      teamId: 'KC',
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
      primarySource: selectPrimarySource(sources),
      version: 1,
      sourceItemCount: 1,
      publisherCount: 1,
      independentSourceCount: 1,
    }));
    for (const story of stories) await editorial.publish(story, 'PUBLISHED');
    assert.equal((await editorial.page('KC', { page: 1, query: 'official source' })).totalItems, 3);
    assert.equal((await lexicalSearch(s, 'roster', 'KC')).length, 1);
    assert.equal((await editorial.get('original-story-0'))!.sources[0].id, 'original-evidence');
    const bindings = {
      db: s.db,
      objects: s.objects,
      env: {
        APP_DATA_BACKEND: 'd1',
        DATABASE_URL: '',
        APP_RUNTIME: 'node',
        APP_EDITORIAL_EMAIL_ENABLED: 'true',
      },
    };
    const generated = await withApplicationBindings(bindings, () =>
      generateDailyThreeAndOut('KC', { now }),
    );
    assert(generated, 'Three & Out must use stored real stories');
    assert.equal(generated.current.stories.length, 3);
    assert.equal(
      (await withApplicationBindings(bindings, () =>
        getDailyThreeAndOut('KC', generated.current.briefingDate),
      ))!.current.id,
      generated.current.id,
    );
    const subscriber = (await new D1AuthRepository(s).createEmailUser({
      email: 'subscriber@example.invalid',
      passwordHash: 'original',
    }))!;
    await s.batch([
      s.statement("UPDATE app_users SET email_verified=1,status='ACTIVE' WHERE id=?", [
        subscriber.id,
      ]),
      s.statement('UPDATE app_settings SET preferences_json=? WHERE user_id=?', [
        JSON.stringify({ preferredTeamId: 'KC', emailEnabled: true }),
        subscriber.id,
      ]),
    ]);
    const mail = new MailQueue(s, 'synthetic-mail-key-at-least-32-characters');
    await mail.subscribe(subscriber.id, true);
    const fanout = await fanoutBriefingMail(s, mail.secret, 'https://example.invalid');
    assert.equal(fanout.status, 'queued');
    assert.equal(
      (await fanoutBriefingMail(s, mail.secret, 'https://example.invalid')).status,
      'idle',
    );
    const sent: any[] = [];
    const provider = {
      name: 'mock',
      dailyLimit: 100,
      monthlyLimit: 3000,
      idempotencyMs: 86400000,
      send: async (message: any) => {
        sent.push(message);
        return { id: 'mock-only' };
      },
    };
    assert.equal((await mail.process(provider)).sent, 1);
    assert.equal((await mail.process(provider)).sent, 0);
    assert(sent[0].text.includes('https://example.invalid/source'));
    assert(sent[0].unsubscribeUrl.includes('/api/email/unsubscribe'));
    await editorial.publish(stories[0], 'WITHDRAWN');
    assert.equal(await editorial.get(stories[0].id), null);
    assert.equal((await lexicalSearch(s, 'roster', 'KC')).length, 0);
    assert.equal(
      (await s.rows('SELECT * FROM app_public_story_versions WHERE id=?', [stories[0].id])).length,
      2,
    );
  } finally {
    await h.close();
  }
});

test('signup mail staging is atomic; explicit rate rejections retry, ambiguous delivery does not', async () => {
  const h = await harness();
  try {
    const s = await store(h);
    const binding = {
      db: s.db,
      objects: s.objects,
      env: {
        APP_DATA_BACKEND: 'd1',
        AUTH_BASE_URL: 'https://example.invalid',
        AUTH_JWT_SECRET: 'synthetic-auth-key-at-least-32-characters',
        APP_MAIL_ENCRYPTION_KEY: 'synthetic-mail-key-at-least-32-characters',
      },
    };
    await assert.rejects(
      withApplicationBindings({ ...binding, env: { APP_DATA_BACKEND: 'd1' } }, () =>
        createD1EmailSignup(
          { email: 'not-created@example.invalid', passwordHash: 'original' },
          'secure-test-token',
        ),
      ),
    );
    assert.equal((await s.rows('SELECT * FROM app_users')).length, 0);
    const user = await withApplicationBindings(binding, () =>
      createD1EmailSignup(
        { email: 'created@example.invalid', passwordHash: 'original' },
        'secure-test-token',
      ),
    );
    assert(user);
    assert.equal((await s.rows('SELECT * FROM app_mail')).length, 1);
    const mail = new MailQueue(s, binding.env.APP_MAIL_ENCRYPTION_KEY);
    const now = Date.now() + 100;
    const rejection = new ResendEmailProvider(
      'mock',
      'test@example.invalid',
      async () => new Response('{}', { status: 429, headers: { 'Retry-After': '2' } }),
    );
    await mail.process(rejection, now);
    let row = (await s.rows<any>('SELECT * FROM app_mail'))[0];
    assert.equal(row.status, 'READY');
    assert.equal(row.attempts, 1);
    assert.equal(row.next_at, now + 2000);
    const unknown = {
      ...rejection,
      name: 'resend',
      dailyLimit: 100,
      monthlyLimit: 3000,
      idempotencyMs: 86400000,
      send: async () => {
        throw Error('lost acknowledgement');
      },
    };
    await mail.process(unknown, now + 2001);
    row = (await s.rows<any>('SELECT * FROM app_mail'))[0];
    assert.equal(row.status, 'UNCERTAIN');
    assert.equal(row.attempts, 2);
    assert.equal((await mail.process(unknown, now + 99999)).considered, 0);
  } finally {
    await h.close();
  }
});

test('scheduled raw publication feeds retry-safe normalized board and precompute without more provider requests', async () => {
  const h = await harness();
  try {
    const s = await store(h);
    let calls = 0;
    const fetcher: typeof fetch = async (input) => {
      if (String(input).includes('/usage'))
        return Response.json({
          success: true,
          data: { rateLimits: { 'per-month': { 'current-entities': 0, 'max-entities': 2500 } } },
        });
      calls++;
      return Response.json({ success: true, data: [fixture()] });
    };
    const now = new Date('2026-10-19T15:00:00Z');
    assert.equal((await scheduledApplicationOdds(s, now, 'mock-only', fetcher)).status, 'complete');
    const metrics = requestMetrics();
    const processed = await processOddsPublication(
      new Storage(instrumentDatabase(s.db, metrics), s.objects),
      now.getTime(),
    );
    assert.equal(processed.status, 'done');
    assert.equal(calls, 1);
    assert(metrics.statements <= 50, `Processing used ${metrics.statements} statements`);
    assert.equal((await processOddsPublication(s, now.getTime())).status, 'idle');
    assert.equal((await s.rows('SELECT * FROM app_parlay_scores')).length, 1);
    assert.equal(
      (await scheduledApplicationOdds(s, now, 'mock-only', fetcher)).status,
      'already-attempted',
    );
    assert.equal(calls, 1);
  } finally {
    await h.close();
  }
});
