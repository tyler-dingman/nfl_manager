import assert from 'node:assert/strict';
import test from 'node:test';
import { calculatePlayerPropTrend } from './trend-service';
import { normalizeHistoricalStatType } from './stat-resolver';
import type { HistoricalPlayerGame } from './types';

const values = [275, 260, 220, 301, 255, 280, 245, 270, 190, 290];
const games = values.map(
  (passingYards, index) =>
    ({
      gameId: `g${index}`,
      date: `2025-12-${String(20 - index).padStart(2, '0')}`,
      season: 2025,
      week: index + 1,
      seasonType: 'REG',
      playerId: 'p1',
      playerName: 'Test QB',
      teamId: index < 5 ? 'KC' : 'OLD',
      opponentTeamId: index < 4 ? 'DEN' : 'LV',
      homeAway: index % 2 ? 'AWAY' : 'HOME',
      position: 'QB',
      passingAttempts: 30,
      passingCompletions: 20,
      passingYards,
      passingTds: 2,
      interceptions: 0,
      carries: 3,
      rushingYards: 10,
      rushingTds: 0,
      targets: 0,
      receptions: 0,
      receivingYards: 0,
      receivingTds: 0,
    }) satisfies HistoricalPlayerGame,
);

test('calculates last ten arbitrary-line results from raw game values', () => {
  const trend = calculatePlayerPropTrend(games, {
    playerId: 'p1',
    statType: 'PASSING_YARDS',
    line: 249.5,
    side: 'OVER',
    currentOpponentId: 'DEN',
  });
  assert.deepEqual(trend.last10, { games: 10, hits: 7, hitRate: 70 });
  assert.equal(trend.vsOpponent.games, 4);
  assert.equal(trend.vsOpponent.average, 264);
  assert.equal(trend.sampleConfidence, 'HIGH');
});
test('supports under, touchdowns, receptions, and rush plus receive', () => {
  assert.equal(
    calculatePlayerPropTrend(games, {
      playerId: 'p1',
      statType: 'PASSING_YARDS',
      line: 249.5,
      side: 'UNDER',
    }).last10.hits,
    3,
  );
  assert.equal(
    calculatePlayerPropTrend(games, {
      playerId: 'p1',
      statType: 'PASSING_TDS',
      line: 1.5,
      side: 'OVER',
    }).last10.hits,
    10,
  );
  assert.equal(
    calculatePlayerPropTrend(games, {
      playerId: 'p1',
      statType: 'RECEPTIONS',
      line: 0.5,
      side: 'UNDER',
    }).last10.hits,
    10,
  );
  assert.equal(
    calculatePlayerPropTrend(games, {
      playerId: 'p1',
      statType: 'RUSH_RECEIVE_YARDS',
      line: 9.5,
      side: 'OVER',
    }).last10.hits,
    10,
  );
});
test('historical team changes do not remove prior-team games', () => {
  assert.equal(
    calculatePlayerPropTrend(games, {
      playerId: 'p1',
      statType: 'PASSING_YARDS',
      line: 0,
      side: 'OVER',
    }).last2Years.games,
    10,
  );
});

test('normalizes current touchdown market names for historical research', () => {
  assert.equal(normalizeHistoricalStatType('PASSING_TD'), 'PASSING_TDS');
  assert.equal(normalizeHistoricalStatType('RUSHING_TD'), 'RUSHING_TDS');
  assert.equal(normalizeHistoricalStatType('RECEIVING_TD'), 'RECEIVING_TDS');
  assert.equal(normalizeHistoricalStatType('TOUCHDOWNS'), 'ANYTIME_TD');
});
