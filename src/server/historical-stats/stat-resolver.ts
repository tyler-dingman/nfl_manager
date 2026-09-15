import type { HistoricalPlayerGame, HistoricalStatType } from './types';

const resolvers: Record<HistoricalStatType, (game: HistoricalPlayerGame) => number | null> = {
  PASSING_YARDS: (g) => g.passingYards,
  PASSING_RUSHING_YARDS: (g) =>
    g.passingYards === null && g.rushingYards === null
      ? null
      : (g.passingYards ?? 0) + (g.rushingYards ?? 0),
  PASSING_TDS: (g) => g.passingTds,
  PASSING_COMPLETIONS: (g) => g.passingCompletions,
  PASSING_ATTEMPTS: (g) => g.passingAttempts,
  INTERCEPTIONS: (g) => g.interceptions,
  RUSHING_YARDS: (g) => g.rushingYards,
  RUSHING_ATTEMPTS: (g) => g.carries,
  RUSHING_TDS: (g) => g.rushingTds,
  RECEIVING_YARDS: (g) => g.receivingYards,
  RECEPTIONS: (g) => g.receptions,
  RECEIVING_TDS: (g) => g.receivingTds,
  RUSH_RECEIVE_YARDS: (g) =>
    g.rushingYards === null && g.receivingYards === null
      ? null
      : (g.rushingYards ?? 0) + (g.receivingYards ?? 0),
  RUSHING_RECEIVING_YARDS: (g) =>
    g.rushingYards === null && g.receivingYards === null
      ? null
      : (g.rushingYards ?? 0) + (g.receivingYards ?? 0),
  ANYTIME_TD: (g) =>
    g.rushingTds === null && g.receivingTds === null
      ? null
      : (g.rushingTds ?? 0) + (g.receivingTds ?? 0),
};

export const isHistoricalStatType = (value: string): value is HistoricalStatType =>
  value in resolvers;
export const normalizeHistoricalStatType = (value: string): HistoricalStatType | null => {
  const aliases: Record<string, HistoricalStatType> = {
    PASSING_INTERCEPTIONS: 'INTERCEPTIONS',
    PASSING_TD: 'PASSING_TDS',
    RUSHING_TD: 'RUSHING_TDS',
    RECEIVING_TD: 'RECEIVING_TDS',
    TOUCHDOWNS: 'ANYTIME_TD',
    RUSHING_RECEIVING_YARDS: 'RUSH_RECEIVE_YARDS',
  };
  const resolved = aliases[value] ?? value;
  return isHistoricalStatType(resolved) ? resolved : null;
};
export const resolveHistoricalStat = (game: HistoricalPlayerGame, stat: HistoricalStatType) =>
  resolvers[stat](game);
export const didHit = (value: number, line: number, side: string) =>
  side === 'UNDER' ? value < line : value > line;
