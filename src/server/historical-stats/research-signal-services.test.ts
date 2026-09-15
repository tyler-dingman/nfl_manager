import assert from 'node:assert/strict';
import test from 'node:test';
import { buildGameScriptContext } from './game-script-context-service';
import { calculateLineMargin } from './line-margin-service';
import { calculatePlayerConsistency } from './player-consistency-service';
import { calculatePlayerUsageTrend } from './player-usage-trend-service';
import type { HistoricalPlayerGame } from './types';

const game = (week: number, values: Partial<HistoricalPlayerGame> = {}): HistoricalPlayerGame => ({
  gameId: `game-${week}`,
  date: `2025-10-${String(week).padStart(2, '0')}`,
  season: 2025,
  week,
  seasonType: 'REG',
  playerId: 'player-1',
  playerName: 'Player One',
  teamId: 'KC',
  opponentTeamId: 'DEN',
  homeAway: 'HOME',
  position: 'QB',
  passingAttempts: 30,
  passingCompletions: 20,
  passingYards: 250,
  passingTds: 2,
  interceptions: 0,
  carries: 2,
  rushingYards: 8,
  rushingTds: 0,
  targets: 0,
  receptions: 0,
  receivingYards: 0,
  receivingTds: 0,
  ...values,
});

test('usage compares the latest five targets with the previous five', () => {
  const targets = [5, 6, 7, 6, 6, 8, 9, 10, 8, 10];
  const result = calculatePlayerUsageTrend(
    targets.map((value, index) => game(index + 1, { position: 'WR', targets: value })),
    'RECEIVING_YARDS',
  );
  assert.equal(result.last5, 9);
  assert.equal(result.previous5, 6);
  assert.equal(result.trendPct, 50);
  assert.equal(result.trendLabel, 'RISING');
});

test('line margin reports passing-yard cushion against the selected line', () => {
  const values = [270, 260, 280, 240, 300];
  const result = calculateLineMargin(
    values.map((value, index) => game(index + 1, { passingYards: value })),
    'PASSING_YARDS',
    224.5,
    'OVER',
  );
  assert.equal(result.average, 270);
  assert.equal(result.averageMargin, 45.5);
  assert.equal(result.clearByBuckets[0]?.hits, 5);
  assert.equal(result.clearByBuckets[1]?.hits, 4);
});

test('stable production scores materially higher than boom-bust production', () => {
  const stable = [66, 72, 69, 75, 68].map((value, index) =>
      game(index + 1, { rushingYards: value }),
    ),
    volatile = [130, 25, 110, 20, 65].map((value, index) =>
      game(index + 1, { rushingYards: value }),
    );
  const steadyScore = calculatePlayerConsistency(stable, 'RUSHING_YARDS')!.score,
    volatileScore = calculatePlayerConsistency(volatile, 'RUSHING_YARDS')!.score;
  assert.ok(steadyScore >= volatileScore + 30);
});

test('stored KC minus eight classifies as heavy favorite with prop-specific context', () => {
  const markets = [
    {
      marketType: 'SPREAD',
      teamId: 'KC',
      side: 'HOME',
      line: -8,
      available: true,
      period: 'game',
      isAltLine: false,
    },
    {
      marketType: 'TOTAL',
      entityId: 'all',
      teamId: null,
      side: 'OVER',
      line: 47.5,
      available: true,
      period: 'game',
      isAltLine: false,
    },
  ];
  const eventTeams = { homeTeamId: 'KC', awayTeamId: 'DEN' };
  const rushing = buildGameScriptContext(markets, 'KC', 'RUSHING_YARDS', eventTeams)!;
  assert.equal(rushing.scriptBucket, 'HEAVY_FAVORITE');
  assert.match(rushing.relevantInsight, /support rushing volume/);
  assert.match(
    buildGameScriptContext(markets, 'KC', 'PASSING_YARDS', eventTeams)!.relevantInsight,
    /late-game passing/,
  );
});

test('game script ignores alternate spreads, team totals, and stale stored team ids', () => {
  const markets = [
    {
      marketType: 'SPREAD',
      teamId: 'DEN',
      side: 'AWAY',
      line: -23.5,
      available: true,
      period: 'game',
      isAltLine: true,
    },
    {
      marketType: 'TOTAL',
      entityId: 'all',
      teamId: null,
      side: 'OVER',
      line: 3.5,
      available: true,
      period: 'game',
      isAltLine: true,
    },
    {
      marketType: 'TOTAL',
      entityId: 'home',
      teamId: 'CHI',
      side: 'OVER',
      line: 22.5,
      available: true,
      period: 'game',
      isAltLine: false,
    },
    {
      marketType: 'SPREAD',
      teamId: 'CHI',
      side: 'HOME',
      line: -2.5,
      available: true,
      period: 'game',
      isAltLine: false,
    },
    {
      marketType: 'SPREAD',
      teamId: 'DEN',
      side: 'AWAY',
      line: 2.5,
      available: true,
      period: 'game',
      isAltLine: false,
    },
    {
      marketType: 'TOTAL',
      entityId: 'all',
      teamId: null,
      side: 'OVER',
      line: 43.5,
      available: true,
      period: 'game',
      isAltLine: false,
    },
  ];
  const eventTeams = { homeTeamId: 'KC', awayTeamId: 'DEN' };
  const chiefs = buildGameScriptContext(markets, 'KC', 'PASSING_YARDS', eventTeams)!;
  const broncos = buildGameScriptContext(markets, 'DEN', 'RUSHING_YARDS', eventTeams)!;

  assert.equal(chiefs.spread, -2.5);
  assert.equal(chiefs.total, 43.5);
  assert.equal(chiefs.scriptBucket, 'CLOSE_GAME');
  assert.equal(broncos.spread, 2.5);
  assert.equal(broncos.total, 43.5);
});
