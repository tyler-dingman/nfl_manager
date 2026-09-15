import assert from 'node:assert/strict';
import test from 'node:test';
import { calculatePlayerVenueTrends } from './player-venue-trend-service';
import { buildVenueInsight } from './venue-insight-service';
import { venueContextForHomeTeam } from './venue-environment-service';
import type { HistoricalPlayerGame } from './types';

const game = (
  week: number,
  homeTeamId: string | undefined,
  receivingYards: number,
): HistoricalPlayerGame => ({
  gameId: `venue-${week}`,
  date: `2025-10-${String(week).padStart(2, '0')}`,
  kickoffAt: `2025-10-${String(week).padStart(2, '0')}T17:00:00Z`,
  season: 2025,
  week,
  seasonType: 'REG',
  playerId: 'p1',
  playerName: 'Player X',
  teamId: 'KC',
  opponentTeamId: 'DEN',
  homeTeamId,
  homeAway: homeTeamId === 'KC' ? 'HOME' : 'AWAY',
  position: 'WR',
  passingAttempts: 0,
  passingCompletions: 0,
  passingYards: 0,
  passingTds: 0,
  interceptions: 0,
  carries: 0,
  rushingYards: 0,
  rushingTds: 0,
  targets: 6,
  receptions: 4,
  receivingYards,
  receivingTds: 0,
});

test('fixed dome, open air, and retractable venues follow explicit roof rules', () => {
  assert.equal(venueContextForHomeTeam('DET').environment, 'INDOOR');
  assert.equal(venueContextForHomeTeam('KC').environment, 'OUTDOOR');
  const retractable = venueContextForHomeTeam('DAL');
  assert.equal(retractable.environment, 'UNKNOWN');
  assert.equal(retractable.statusKnown, false);
});

test('venue splits exclude unknown games from indoor and outdoor denominators', () => {
  const result = calculatePlayerVenueTrends(
    [
      game(1, 'DET', 60),
      game(2, 'MIN', 70),
      game(3, 'KC', 55),
      game(4, 'CHI', 40),
      game(5, 'DEN', 45),
      game(6, 'DAL', 80),
      game(7, undefined, 90),
    ],
    'RECEIVING_YARDS',
    49.5,
    'OVER',
  );
  assert.deepEqual(
    {
      games: result.indoor.games,
      hits: result.indoor.hits,
      confidence: result.indoor.sampleConfidence,
    },
    { games: 2, hits: 2, confidence: 'Very limited' },
  );
  assert.deepEqual(
    {
      games: result.outdoor.games,
      hits: result.outdoor.hits,
      confidence: result.outdoor.sampleConfidence,
    },
    { games: 3, hits: 1, confidence: 'Limited' },
  );
  assert.equal(result.unknown.games, 2);
});

test('venue insight requires meaningful samples and rate separation', () => {
  const insight = buildVenueInsight(
    'Player X',
    'RECEIVING_YARDS',
    49.5,
    'OVER',
    'OUTDOOR',
    { games: 6, hits: 5, hitRate: 83.3 },
    { games: 7, hits: 2, hitRate: 28.6 },
  );
  assert.match(insight ?? '', /2 of 7 outdoor games/);
  assert.equal(
    buildVenueInsight(
      'Player X',
      'RECEIVING_YARDS',
      49.5,
      'OVER',
      'INDOOR',
      { games: 2, hits: 2, hitRate: 100 },
      { games: 7, hits: 2, hitRate: 28.6 },
    ),
    null,
  );
});
