import { calculateLabScoreV2 } from '../../../src/server/historical-stats/lab-score-v2';
import type { HistoricalPlayerGame } from '../../../src/server/historical-stats/types';
const asOf = '2026-10-03T12:00:00Z';
const games: HistoricalPlayerGame[] = Array.from({ length: 10 }, (_, i) => ({
  gameId: String(i),
  date: new Date(Date.parse(asOf) - (5 + i * 7) * 86400000).toISOString(),
  season: 2026,
  week: 10 - i,
  seasonType: 'REG',
  playerId: 'p',
  playerName: 'Preview Player',
  teamId: 'KC',
  opponentTeamId: 'LV',
  homeAway: 'HOME',
  position: 'RB',
  passingAttempts: 0,
  passingCompletions: 0,
  passingYards: 0,
  passingTds: 0,
  interceptions: 0,
  carries: i < 5 ? 17 : 3,
  rushingYards: i < 5 ? 68 : 12,
  rushingTds: 0,
  targets: 3,
  receptions: 2,
  receivingYards: 20,
  receivingTds: 0,
}));
export const projection = calculateLabScoreV2(games, {
  asOf,
  playerId: 'p',
  statType: 'RUSHING_YARDS',
  line: 52.5,
  side: 'OVER',
});
export const empty = calculateLabScoreV2([], {
  asOf,
  playerId: 'p',
  statType: 'RUSHING_YARDS',
  line: 52.5,
  side: 'OVER',
});
