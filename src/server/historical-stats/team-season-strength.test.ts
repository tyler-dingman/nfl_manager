import assert from 'node:assert/strict';
import test from 'node:test';
import { defenseContextForMarket } from './market-defense-mapping';
import { buildUpcomingMatchup, matchupLabelForRank } from './upcoming-matchup-service';
import { getPropMissContext } from './prop-miss-context-service';
import type { HistoricalPlayerGame } from './types';

const game = (value: number, rank: number, date: string): HistoricalPlayerGame => ({
  gameId: date,
  date,
  season: 2025,
  week: 1,
  seasonType: 'REG',
  playerId: 'p1',
  playerName: 'Player',
  teamId: 'KC',
  opponentTeamId: 'DEN',
  homeAway: 'HOME',
  position: 'QB',
  passingAttempts: 30,
  passingCompletions: 20,
  passingYards: value,
  passingTds: 2,
  interceptions: 0,
  carries: 0,
  rushingYards: 0,
  rushingTds: 0,
  targets: 0,
  receptions: 0,
  receivingYards: 0,
  receivingTds: 0,
  opponentSeasonStrength: {
    season: 2025,
    teamId: 'DEN',
    passDefenseRank: rank,
    passingYardsAllowedPerGame: 201.8,
    rushDefenseRank: 12,
    rushingYardsAllowedPerGame: 110,
    scoringDefenseRank: 8,
    pointsAllowedPerGame: 19,
    totalDefenseRank: 7,
    totalYardsAllowedPerGame: 311.8,
  },
});

test('central market mapping selects the relevant defense', () => {
  assert.equal(defenseContextForMarket('PASSING_YARDS'), 'PASS');
  assert.equal(defenseContextForMarket('RECEPTIONS'), 'PASS');
  assert.equal(defenseContextForMarket('RUSHING_ATTEMPTS'), 'RUSH');
  assert.equal(defenseContextForMarket('RUSH_RECEIVE_YARDS'), 'TOTAL');
  assert.equal(defenseContextForMarket('ANYTIME_TD'), 'SCORING');
});

test('upcoming matchup exposes the market-specific rank and underlying metric', () => {
  const matchup = buildUpcomingMatchup(
    'KC',
    'Kansas City Chiefs',
    'PASS',
    game(250, 16, '2025-09-01').opponentSeasonStrength!,
  );
  assert.equal(matchup.defenseLabel, 'Pass Defense');
  assert.equal(matchup.defenseRank, 16);
  assert.equal(matchup.relevantMetricName, 'Pass yds allowed / game');
  assert.equal(matchup.matchupLabel, 'Solid matchup');
  assert.equal(matchupLabelForRank(3), 'Tough matchup');
  assert.equal(matchupLabelForRank(30), 'Very favorable matchup');
});

test('miss context uses the defense from the historical game season', () => {
  const result = getPropMissContext(
    [game(250, 20, '2025-10-01'), game(218, 5, '2025-09-01')],
    'PASSING_YARDS',
    225,
    'OVER',
  );
  assert.equal(result.misses.length, 1);
  assert.equal(result.misses[0]?.opponentRelevantDefenseRank, 5);
  assert.equal(result.misses[0]?.opponentRelevantDefenseMetric, 201.8);
  assert.equal(result.averageRelevantDefenseRank, 5);
});
