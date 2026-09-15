import assert from 'node:assert/strict';
import test from 'node:test';
import { getGameByGameTrend } from './game-by-game-trend-service';
import { buildLineLadder } from './line-ladder-service';
import {
  calculateOpponentVsPosition,
  qualifyOpponentPerformances,
} from './opponent-vs-position-service';
import type { HistoricalPlayerGame } from './types';
import { buildResultDistribution } from './result-distribution-service';
import { formatLineLadderThreshold } from '@/lib/parlay-lab/market-display';
import { buildLineLadderInsight } from './line-ladder-insight-service';

const make = (
  value: number,
  index: number,
  overrides: Partial<HistoricalPlayerGame> = {},
): HistoricalPlayerGame => ({
  gameId: `g${index}`,
  date: `2025-10-${String(index + 1).padStart(2, '0')}`,
  season: 2025,
  week: index + 1,
  seasonType: 'REG',
  playerId: 'p',
  playerName: 'Player',
  teamId: 'KC',
  opponentTeamId: 'DEN',
  homeAway: index % 2 ? 'AWAY' : 'HOME',
  position: 'QB',
  passingAttempts: 30,
  passingCompletions: 20,
  passingYards: value,
  passingTds: 2,
  interceptions: 0,
  carries: 4,
  rushingYards: 12,
  rushingTds: 0,
  targets: 0,
  receptions: 0,
  receivingYards: 0,
  receivingTds: 0,
  ...overrides,
});
const games = [290, 280, 270, 260, 255, 245, 235, 310, 300, 225]
  .map((value, index) => make(value, index))
  .reverse();

test('line ladder evaluates every threshold from one raw sample', () => {
  const ladder = buildLineLadder(
    games,
    'PASSING_YARDS',
    249.5,
    'OVER',
    [224.5, 249.5, 274.5, 299.5].map((line, index) => ({
      id: String(index),
      line,
      side: 'OVER',
      sportsbook: 'FANDUEL' as const,
      odds: -110,
      available: true,
      deeplink: 'https://example.com',
    })),
  );
  assert.equal(ladder.rows.find((r) => r.threshold === 249.5)?.hits, 7);
  assert.equal(ladder.rows.find((r) => r.threshold === 274.5)?.hits, 4);
  assert.equal(ladder.rows.find((r) => r.threshold === 299.5)?.hits, 2);
  assert.equal(ladder.rows.find((r) => r.threshold === 249.5)?.isCurrentLine, true);
});
test('opponent QB sample excludes a low-attempt backup', () => {
  const rows = [
    ...Array.from({ length: 10 }, (_, i) => make(240 + i * 4, i)),
    make(400, 20, { gameId: 'g0', passingAttempts: 3, playerId: 'backup' }),
  ];
  const result = calculateOpponentVsPosition(rows, 'QB', 'PASSING_YARDS', 249.5, 'OVER');
  assert.equal(result.last10.games, 10);
  assert.equal(
    qualifyOpponentPerformances(rows, 'QB').some((row) => row.playerId === 'backup'),
    false,
  );
  assert.equal(result.sampleConfidence, 'HIGH');
});
test('lead-back opponent sample does not count low-volume backs', () => {
  const rows = [
    make(0, 0, { position: 'RB', carries: 18, rushingYards: 80 }),
    make(0, 1, { gameId: 'g0', position: 'RB', carries: 6, rushingYards: 40 }),
    make(0, 2, { gameId: 'g0', position: 'RB', carries: 2, rushingYards: 10 }),
  ];
  const qualified = qualifyOpponentPerformances(rows, 'RB');
  assert.equal(qualified.length, 1);
  assert.equal(qualified[0]?.carries, 18);
});
test('game chart returns chronological points and current reference line', () => {
  const points = getGameByGameTrend(games, 'PASSING_YARDS', 249.5, 'OVER', 10);
  assert.equal(points.length, 10);
  assert.equal(points[0]?.date, '2025-10-01');
  assert.equal(points[9]?.date, '2025-10-10');
  assert.ok(points.every((point) => point.line === 249.5));
});
test('result distribution uses centralized passing-yard bins', () => {
  const distribution = buildResultDistribution(games, 'PASSING_YARDS', 10);
  assert.equal(distribution.sampleSize, 10);
  assert.equal(
    distribution.bins.reduce((sum, bin) => sum + bin.games, 0),
    10,
  );
  assert.equal(distribution.bins.find((bin) => bin.label === '300+')?.games, 2);
});
test('line ladder formatter always includes stat context and singular grammar', () => {
  assert.equal(formatLineLadderThreshold('RECEPTIONS', 0.5, 'OVER'), '1+ reception');
  assert.equal(formatLineLadderThreshold('RECEPTIONS', 3.5, 'OVER'), '4+ receptions');
  assert.equal(formatLineLadderThreshold('PASSING_YARDS', 249.5, 'OVER'), '250+ passing yards');
  assert.equal(formatLineLadderThreshold('RUSHING_YARDS', 49.5, 'OVER'), '50+ rushing yards');
  assert.equal(formatLineLadderThreshold('RECEIVING_TDS', 0.5, 'OVER'), '1+ receiving TD');
  assert.equal(
    formatLineLadderThreshold('PASSING_YARDS', 250.5, 'UNDER'),
    'Under 250 passing yards',
  );
});
test('line ladder insight only reports a supported push relationship', () => {
  const insight = buildLineLadderInsight(
    [
      {
        displayThreshold: '4+ receptions',
        hitRate: 90,
        isCurrentLine: true,
        fanduelPrice: -136,
        draftkingsPrice: -134,
      },
      {
        displayThreshold: '5+ receptions',
        hitRate: 90,
        isCurrentLine: false,
        fanduelPrice: 162,
        draftkingsPrice: 157,
      },
    ],
    'Courtland Sutton',
  );
  assert.match(insight ?? '', /5\+ receptions/);
  assert.match(insight ?? '', /nearly as often/);
});
