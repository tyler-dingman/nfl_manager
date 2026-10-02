/** Disposable local-only lifecycle exercise. Never resets or edits an existing user's save. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { authDb } from '../src/server/auth/database';
import {
  createFranchiseSimulation,
  startFranchiseAtWeekOne,
  advanceSimulation,
} from '../src/lib/franchise-simulation';
import { createFallbackRegularSeasonSchedule } from '../src/server/front-office/calendar';
import { NFL_LEAGUE_DATA } from '../src/server/data/nfl-data';
import { generateFrontOfficeEvents } from '../src/server/front-office/event-engine';
import {
  upsertFrontOfficeSaveMetadata,
  saveFranchiseSimulation,
  getFrontOfficeSaveMetadata,
} from '../src/server/front-office/repository';
import {
  listFrontOfficeEvents,
  countUnreadFrontOfficeNews,
  markAllFrontOfficeEventsRead,
  persistFrontOfficeEvents,
} from '../src/server/front-office/events-repository';
import {
  isFrontOfficeBreakingNews,
  frontOfficeEventIncludesTeam,
} from '../src/lib/front-office-league-news';
import { ensureSaveState } from '../src/server/api/store';
import { createTrade, addTradeAsset, proposeTrade } from '../src/server/api/trades';
import { franchiseTransactionsForNews } from '../src/server/front-office/transaction-news';

async function main() {
  const host = new URL(process.env.DATABASE_URL ?? '').hostname;
  if (process.env.NODE_ENV === 'production' || !['localhost', '127.0.0.1'].includes(host))
    throw Error('Only a local development database is allowed.');
  const db = authDb(),
    userId = randomUUID(),
    prefix = `dev-news-${randomUUID()}`,
    saveId = `${prefix}-A`,
    other = `${prefix}-B`;
  await db`INSERT INTO users(id,display_name) VALUES(${userId},'Disposable franchise news test')`;
  const report: unknown[] = [];
  try {
    const teams = NFL_LEAGUE_DATA.teams.map((t) => ({
      abbr: t.abbr,
      conference: t.conference,
      division: t.division,
      overall: t.teamOverview ?? 75,
    }));
    const schedule = createFallbackRegularSeasonSchedule(
      teams.map((t) => t.abbr),
      2026,
    );
    let state = startFranchiseAtWeekOne(
      createFranchiseSimulation({
        seed: 'news-lifecycle-test',
        season: 2026,
        teams,
        games: schedule.map((g) => ({
          id: g.id,
          week: g.week,
          homeTeam: g.homeTeam!,
          awayTeam: g.awayTeam!,
        })),
      }),
    );
    for (const id of [saveId, other]) {
      await upsertFrontOfficeSaveMetadata({
        userId,
        saveId: id,
        teamAbbr: 'KC',
        season: 2026,
        selectedPath: 'full',
        simulationPhase: 'week-1',
      });
      await saveFranchiseSimulation({ userId, saveId: id, expectedVersion: 1, simulation: state });
      assert.equal((await listFrontOfficeEvents(userId, id)).length, 0);
      assert.equal(await countUnreadFrontOfficeNews(userId, id), 0);
    }
    report.push({ phase: 'NEW', news: 0, breaking: 0, unread: 0 });
    let version = 2;
    for (let phase = 2; phase <= 10; phase++) {
      const previous = structuredClone(state);
      if (phase === 10) {
        // Execute an actual user trade in this disposable save, using the existing trade engine.
        const store = ensureSaveState(saveId, 'KC', 2026);
        store.header.capSpace = 200;
        store.teamCaps.KC = 200;
        store.teamCaps.CHI = 200;
        const created = createTrade(saveId, 'CHI');
        assert.ok(created.ok);
        if (!created.ok) throw Error('Trade setup failed');
        const outgoing = [...created.data.userRoster].sort(
          (a, b) => (b.rating ?? 0) - (a.rating ?? 0),
        )[0];
        const incoming =
          [...created.data.partnerRoster]
            .sort((a, b) => (a.rating ?? 0) - (b.rating ?? 0))
            .find((p) => p.position === outgoing.position) ?? created.data.partnerRoster[0];
        assert.ok(
          addTradeAsset(
            created.data.trade.id,
            { side: 'send', type: 'player', playerId: outgoing.id },
            saveId,
          ).ok,
        );
        assert.ok(
          addTradeAsset(
            created.data.trade.id,
            { side: 'receive', type: 'player', playerId: incoming.id },
            saveId,
          ).ok,
        );
        const result = proposeTrade(created.data.trade.id, saveId);
        assert.ok(
          result.ok && result.data.accepted,
          'Existing trade engine must accept the disposable trade',
        );
        state.transactions = franchiseTransactionsForNews(store);
        assert.equal(state.transactions.filter((t) => t.type === 'trade').length, 2);
      }
      state = advanceSimulation(state, `week-${phase}`);
      const events = generateFrontOfficeEvents({
        saveId,
        teamAbbr: 'KC',
        previous,
        current: state,
      });
      const news = events.filter((e) => e.metadata.channel !== 'MESSAGE');
      assert.equal(news.length, phase === 10 ? 8 : 3);
      const saved = await saveFranchiseSimulation({
        userId,
        saveId,
        expectedVersion: version,
        simulation: state,
        events,
      });
      assert.ok(saved);
      version = saved!.version!;
      assert.equal(
        await saveFranchiseSimulation({
          userId,
          saveId,
          expectedVersion: version - 1,
          simulation: state,
          events,
        }),
        null,
        'stale retry must not commit',
      );
      assert.equal(
        (await persistFrontOfficeEvents(userId, events)).length,
        0,
        'retry must not duplicate news',
      );
      const fetched = await listFrontOfficeEvents(userId, saveId),
        again = await listFrontOfficeEvents(userId, saveId);
      assert.deepEqual(fetched, again, 'reads do not create stories');
      assert.equal(
        (await getFrontOfficeSaveMetadata(userId, saveId))?.simulation?.phase,
        state.phase,
      );
      assert.equal((await listFrontOfficeEvents(userId, other)).length, 0);
      assert.equal(await countUnreadFrontOfficeNews(userId, other), 0);
      if ([2, 3, 4, 10].includes(phase))
        report.push({
          phase: phase === 10 ? 'TRADE DEADLINE (after Week 9)' : `Week ${phase}`,
          generated: news.length,
          types: news.reduce(
            (m, e) => {
              const k = String(e.metadata.newsCategory ?? e.type);
              m[k] = (m[k] ?? 0) + 1;
              return m;
            },
            {} as Record<string, number>,
          ),
          breaking: news.filter((e) => isFrontOfficeBreakingNews(e as any)).length,
          myTeam: news.filter((e) => frontOfficeEventIncludesTeam(e as any, 'KC')).length,
          unread: await countUnreadFrontOfficeNews(userId, saveId),
        });
      if (phase === 3) {
        await markAllFrontOfficeEventsRead(userId, saveId);
        assert.equal(await countUnreadFrontOfficeNews(userId, saveId), 0);
        assert.ok(
          (await listFrontOfficeEvents(userId, saveId))
            .filter((e) => e.metadata.channel !== 'MESSAGE')
            .every((e) => e.readAt),
        );
        report.push({ phase: 'Mark all read after Week 3', unread: 0 });
      }
    }
    const otherBefore = (await getFrontOfficeSaveMetadata(userId, other))!.simulation!;
    const otherAfter = advanceSimulation(otherBefore, 'week-2');
    const otherEvents = generateFrontOfficeEvents({
      saveId: other,
      teamAbbr: 'KC',
      previous: otherBefore,
      current: otherAfter,
    });
    await saveFranchiseSimulation({
      userId,
      saveId: other,
      expectedVersion: 2,
      simulation: otherAfter,
      events: otherEvents,
    });
    assert.equal(await countUnreadFrontOfficeNews(userId, other), 3);
    await markAllFrontOfficeEventsRead(userId, saveId);
    assert.equal(
      await countUnreadFrontOfficeNews(userId, other),
      3,
      'reading A must not mark B read',
    );
    assert.ok((await listFrontOfficeEvents(userId, other)).every((e) => e.saveId === other));
    const beforeFailure = await getFrontOfficeSaveMetadata(userId, other);
    await assert.rejects(
      saveFranchiseSimulation({
        userId,
        saveId: other,
        expectedVersion: beforeFailure!.version!,
        simulation: advanceSimulation(otherAfter, 'week-3'),
        events: [
          {
            ...otherEvents[0],
            id: 'invalid-test',
            dedupeKey: 'invalid-test',
            priority: 'invalid' as any,
          },
        ],
      }),
    );
    assert.equal(
      (await getFrontOfficeSaveMetadata(userId, other))?.version,
      beforeFailure?.version,
      'failed event insert rolls back simulation',
    );
    report.push({
      checks:
        'Cross-save read isolation, stale retry, duplicate insert, repeated reads, persisted state, and atomic rollback passed',
    });
    console.log(JSON.stringify(report, null, 2));
  } finally {
    // The UUID belongs solely to this run; cascading deletion removes only our disposable test records.
    await db`DELETE FROM users WHERE id=${userId} AND display_name='Disposable franchise news test'`;
    await db.end();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
