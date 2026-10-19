import test from 'node:test';
import assert from 'node:assert/strict';
import { multiHarness } from '../test/multi-harness';
import { MultiD1 } from '../../../packages/storage/multi-d1';
import { fetchOddsPage, startOddsFetch } from '../../../packages/storage/odds-fetch';
import { processOddsPublication } from '../../application/odds-processing';
import { D1OddsBoard } from '../../../packages/storage/odds-board';
import { storedTransferLegs } from '../../../packages/storage/sportsbook-transfers';
import { D1AuthRepository } from '../../../packages/storage/auth';
import {
  saveCrossShardContent,
  verifyCrossShardReferences,
} from '../../../packages/storage/cross-shard-saves';
const fixture = () => ({
  eventID: 'original-provider-event',
  season: 2026,
  week: 9,
  status: { startsAt: new Date(Date.now() + 86400000).toISOString() },
  teams: { home: { teamID: 'KC' }, away: { teamID: 'DEN' } },
  players: { PATRICK_MAHOMES_1_NFL: { name: 'Patrick Mahomes', teamID: 'KC', position: 'QB' } },
  odds: Object.fromEntries(
    Array.from({ length: 1000 }, (_, i) => [
      'passing-' + i,
      {
        oddID: 'passingYards-PATRICK_MAHOMES_1_NFL-game-ou-over-' + i,
        statID: 'passingYards',
        statEntityID: 'PATRICK_MAHOMES_1_NFL',
        periodID: 'game',
        betTypeID: 'ou',
        sideID: 'over',
        byBookmaker: {
          fanduel: { oddID: 'fd-original-' + i, odds: -110, overUnder: 200.5 + i, available: true },
          draftkings: {
            oddID: 'dk-original-' + i,
            odds: -115,
            overUnder: 200.5 + i,
            available: true,
          },
        },
      },
    ]),
  ),
});
test('bounded multi-D1 provider capture, board/score phases, transfer resolution and saved evidence survive restart', async () => {
  const h = await multiHarness();
  const metrics: any[] = [];
  const run = async <T>(label: string, fn: (r: MultiD1) => Promise<T>) => {
    const r = new MultiD1(h.db);
    try {
      return await fn(r);
    } finally {
      metrics.push({ label, ...r.metrics });
      console.info(label, JSON.stringify(r.metrics));
      assert(r.metrics.statements <= 50);
    }
  };
  try {
    const now = Date.parse('2026-10-19T15:00:00Z'),
      event = fixture();
    await run('start', (r) => startOddsFetch(r.shared(), new Date(now)));
    let calls = 0;
    const fetcher: typeof fetch = async (input) => {
      calls++;
      return new Response(
        JSON.stringify(
          String(input).includes('/account/usage')
            ? {
                success: true,
                data: {
                  rateLimits: { 'per-month': { 'current-entities': 0, 'max-entities': 1000 } },
                },
              }
            : { success: true, data: [event] },
        ),
        { headers: { 'Content-Type': 'application/json' } },
      );
    };
    assert.equal(
      (
        await run('capture-2000', (r) =>
          fetchOddsPage(r.shared(), {
            apiKey: 'synthetic-key',
            verifiedDailyHttpCeiling: 40,
            now,
            fetcher,
          }),
        )
      ).status,
      'complete',
    );
    assert.equal(calls, 2);
    await h.restart();
    assert.equal(
      (await run('board-2000', (r) => processOddsPublication(r.shared(), now))).status,
      'board-ready',
    );
    await h.restart();
    assert.equal(
      (await run('scores-2000', (r) => processOddsPublication(r.shared(), now))).status,
      'done',
    );
    const board = new D1OddsBoard(new MultiD1(h.db).shared()),
      events = await board.events(true),
      markets = await board.markets(events[0].id);
    assert.equal(markets.length, 2000);
    assert(
      markets.every(
        (m: any) => m.providerMarketId && m.providerPlayerId === 'PATRICK_MAHOMES_1_NFL',
      ),
    );
    assert(
      markets.every((m: any) =>
        m.providerSelectionId.startsWith(
          m.sportsbook === 'FANDUEL' ? 'fd-original-' : 'dk-original-',
        ),
      ),
      'Original selection IDs must belong to their actual sportsbook',
    );
    const transferIds = [markets[0].id];
    for (let i = 1; i < 16; i++) {
      const id = await run('additional-event-' + i, (r) =>
        new D1OddsBoard(r.shared()).publishProvider(
          { ...event, eventID: 'original-provider-event-' + i },
          now,
        ),
      );
      const current = await new D1OddsBoard(new MultiD1(h.db).shared()).markets(id);
      transferIds.push(current[0].id);
    }
    const crossEvent = await run('transfer-16-events', (r) =>
      storedTransferLegs(r.shared(), transferIds),
    );
    assert.equal(new Set(crossEvent.map((l) => l.eventId)).size, 16);
    const legs = await run('transfer-lookup', (r) =>
      storedTransferLegs(r.shared(), [markets[0].id]),
    );
    assert(legs.some((l) => l.sportsbook === 'FANDUEL'));
    assert(legs.some((l) => l.sportsbook === 'DRAFTKINGS'));
    const user = await new D1AuthRepository(new MultiD1(h.db).users()).createEmailUser({
      email: 'saved-bet@example.invalid',
      passwordHash: 'original-phc',
    });
    assert(user);
    await run('save-bet', (r) =>
      saveCrossShardContent(r, user.id, {
        contentType: 'OTHER',
        contentId: 'original-slip',
        title: 'Original slip',
        metadata: {
          kind: 'PARLAY',
          play: {
            event: { id: events[0].id },
            selections: [{ ...markets[0], eventId: events[0].id }],
          },
        },
      }),
    );
    await h.restart();
    await verifyCrossShardReferences(h.db);
    await run('next-slot', (r) => startOddsFetch(r.shared(), new Date('2026-10-21T15:00:00Z')));
    await assert.rejects(
      run('uncertain', (r) =>
        fetchOddsPage(r.shared(), {
          apiKey: 'synthetic-key',
          verifiedDailyHttpCeiling: 40,
          fetcher: async () => {
            throw Error('interrupted upstream');
          },
        }),
      ),
      /interrupted/,
    );
    await h.restart();
    let retried = false;
    assert.equal(
      (
        await run('no-ambiguous-retry', (r) =>
          fetchOddsPage(r.shared(), {
            apiKey: 'synthetic-key',
            verifiedDailyHttpCeiling: 40,
            fetcher: async () => {
              retried = true;
              throw Error('must not retry');
            },
          }),
        )
      ).status,
      'idle',
    );
    assert.equal(retried, false);
  } finally {
    console.info('MULTI_D1_ODDS_METRICS', JSON.stringify(metrics));
    await h.close();
  }
});
