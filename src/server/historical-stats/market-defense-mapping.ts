import type { HistoricalStatType } from './types';

export type DefenseContext = 'PASS' | 'RUSH' | 'TOTAL' | 'SCORING';

const mapping: Record<HistoricalStatType, DefenseContext> = {
  PASSING_YARDS: 'PASS',
  PASSING_RUSHING_YARDS: 'TOTAL',
  PASSING_TDS: 'PASS',
  PASSING_COMPLETIONS: 'PASS',
  PASSING_ATTEMPTS: 'PASS',
  INTERCEPTIONS: 'PASS',
  RECEIVING_YARDS: 'PASS',
  RECEPTIONS: 'PASS',
  RECEIVING_TDS: 'PASS',
  RUSHING_YARDS: 'RUSH',
  RUSHING_ATTEMPTS: 'RUSH',
  RUSHING_TDS: 'RUSH',
  RUSH_RECEIVE_YARDS: 'TOTAL',
  RUSHING_RECEIVING_YARDS: 'TOTAL',
  ANYTIME_TD: 'SCORING',
};

export const defenseContextForMarket = (statType: HistoricalStatType) => mapping[statType];

export const defenseContextLabel = (context: DefenseContext) =>
  ({
    PASS: 'Pass Defense',
    RUSH: 'Rush Defense',
    TOTAL: 'Total Defense',
    SCORING: 'Scoring Defense',
  })[context];
