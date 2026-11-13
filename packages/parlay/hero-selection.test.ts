import test from 'node:test';
import assert from 'node:assert/strict';
import { selectHeroProps } from './hero-selection';
import { TEAM_LIST } from '../../src/data/teams';
import type { HomeMarket } from './research';
const now = Date.parse('2026-10-22T12:00:00Z');
const events = [{ id: 'game', kickoffAt: '2026-10-26T00:20:00Z' }];
function offer(playerId: string, score: number, suffix = '', teamId = 'KC'): HomeMarket {
  return {
    id: playerId + suffix,
    normalizedKey: playerId + suffix,
    eventId: 'game',
    playerId,
    playerName: playerId,
    teamId,
    marketType: 'RECEIVING_YARDS',
    statId: 'receiving_yards',
    entityId: playerId,
    period: 'game',
    side: 'OVER',
    line: 20.5,
    sportsbook: 'FANDUEL',
    odds: -110,
    available: true,
    isAltLine: false,
    lineType: 'main',
    deeplink: null,
    trend: {
      trendScore: score,
      projection: {
        projection: 40,
        modelScore: score,
        recommendation: 'OVER',
        estimatedProbability: 0.7,
        pushProbability: 0,
        dataQuality: { reliability: 0.8, freshness: 1, currentRoleKnown: true },
      },
    },
  } as HomeMarket;
}
test('three higher-ranked offers from one player cannot occupy the top three', () => {
  const rows = [
    offer('Gray', 90),
    offer('Gray', 89, 'alt'),
    offer('Gray', 88, 'other'),
    offer('Kelce', 80),
    offer('Worthy', 75),
    offer('Fourth', 70),
  ];
  const before = structuredClone(rows);
  assert.deepEqual(
    selectHeroProps(rows, 'KC', events, now).map((m) => m.playerId),
    ['Gray', 'Kelce', 'Worthy'],
  );
  assert.deepEqual(rows, before);
});
test('sparse teams return fewer cards instead of repeating a player', () => {
  assert.equal(
    selectHeroProps([offer('Gray', 90), offer('Gray', 85, 'alt')], 'KC', events, now).length,
    1,
  );
  assert.equal(
    selectHeroProps(
      [offer('Gray', 90), offer('Gray', 85, 'alt'), offer('Kelce', 75)],
      'KC',
      events,
      now,
    ).length,
    2,
  );
});
test('rule applies to every team and both main/alternate preferences', () => {
  for (const { abbr: team } of TEAM_LIST) {
    for (const altLines of [false, true]) {
      const rows = [
        offer('One', 90, '', team),
        offer('One', 89, 'alt', team),
        offer('Two', 80, '', team),
        offer('Three', 75, '', team),
      ];
      assert.equal(
        new Set(
          selectHeroProps(rows, team, events, now, { altLines, maxOdds: -500 }).map(
            (m) => m.playerId,
          ),
        ).size,
        3,
      );
    }
  }
});
test('diversity never admits another team, started events or unqualified players', () => {
  const weak = offer('Unknown', 95);
  weak.trend!.projection!.dataQuality.currentRoleKnown = false;
  const rows = [offer('One', 90), offer('OtherTeam', 92, '', 'SEA'), weak];
  assert.deepEqual(
    selectHeroProps(rows, 'KC', events, now).map((m) => m.playerId),
    ['One'],
  );
  assert.deepEqual(selectHeroProps(rows, 'KC', events, Date.parse('2026-10-27')), []);
});
