import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveGameEnvironment, restBucketFor } from './game-environment-service';
import { relevantEnvironmentSplits } from './game-environment-insight-service';
import { calculatePlayerEnvironmentTrends } from './player-environment-trend-service';
import type { HistoricalPlayerGame } from './types';

test('classifies Monday night and only returns its relevant primary splits', () => {
  const context = deriveGameEnvironment('2026-09-15T00:15:00Z', '2026-09-07T20:25:00Z');
  assert.equal(context.gameWindow, 'MONDAY_NIGHT');
  assert.equal(context.primetimeType, 'MNF');
  assert.equal(context.isNightGame, true);
  assert.equal(context.restBucket, 'NORMAL_REST');
  const blank = { games: 0, hits: 0, hitRate: null } as never;
  const relevant = relevantEnvironmentSplits(context, {
    primetime: blank,
    mondayNight: blank,
    night: blank,
    normalRest: blank,
  });
  assert.deepEqual(
    relevant.map((item) => item.key),
    ['primetime', 'mondayNight', 'night', 'normalRest'],
  );
});

test('classifies Sunday to Thursday as TNF on short rest', () => {
  const context = deriveGameEnvironment('2025-10-10T00:15:00Z', '2025-10-05T17:00:00Z');
  assert.equal(context.gameWindow, 'THURSDAY_NIGHT');
  assert.equal(context.restDays, 4);
  assert.equal(context.restBucket, 'SHORT_REST');
});

test('classifies bye rest and Sunday early day games', () => {
  assert.equal(restBucketFor(14), 'EXTENDED_REST');
  const context = deriveGameEnvironment('2025-09-21T17:00:00Z', '2025-09-14T17:00:00Z');
  assert.equal(context.gameWindow, 'SUNDAY_EARLY');
  assert.equal(context.isDayGame, true);
  assert.equal(context.isPrimetime, false);
  assert.equal(context.restBucket, 'NORMAL_REST');
});

test('environment trends evaluate every split against the selected line', () => {
  const game = (id: string, kickoffAt: string, passingYards: number): HistoricalPlayerGame => ({
    gameId: id,
    date: kickoffAt.slice(0, 10),
    kickoffAt,
    season: 2025,
    week: Number(id),
    seasonType: 'REG',
    playerId: 'p1',
    playerName: 'Quarterback',
    teamId: 'KC',
    opponentTeamId: 'DEN',
    homeAway: 'HOME',
    position: 'QB',
    passingAttempts: 30,
    passingCompletions: 20,
    passingYards,
    passingTds: 2,
    interceptions: 0,
    carries: 2,
    rushingYards: 5,
    rushingTds: 0,
    targets: 0,
    receptions: 0,
    receivingYards: 0,
    receivingTds: 0,
  });
  const result = calculatePlayerEnvironmentTrends(
    [
      game('1', '2025-09-09T00:15:00Z', 250),
      game('2', '2025-09-16T00:15:00Z', 230),
      game('3', '2025-09-23T00:15:00Z', 210),
      game('4', '2025-09-30T00:15:00Z', 260),
    ],
    'PASSING_YARDS',
    224.5,
    'OVER',
  );
  assert.equal(result.mondayNight.games, 4);
  assert.equal(result.mondayNight.hits, 3);
  assert.equal(result.mondayNight.sampleConfidence, 'Limited');
});
