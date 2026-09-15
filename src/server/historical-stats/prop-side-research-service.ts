import { calculateLineMargin } from './line-margin-service';
import { calculatePlayerConsistency } from './player-consistency-service';
import { calculatePlayerUsageTrend } from './player-usage-trend-service';
import { normalizeHistoricalStatType } from './stat-resolver';
import { calculatePlayerPropTrend } from './trend-service';
import type { HistoricalPlayerGame } from './types';

export type LabFindSide = 'OVER' | 'UNDER' | null;
export type LabSignal = { label: string; value: string; score: number };
export type LabSideResult = {
  sampleSize: number;
  internalScore: number;
  supportingGroups: number;
  positiveSignals: LabSignal[];
  concerns: LabSignal[];
};

export const LAB_FIND_MIN_SCORE = 80;
export const LAB_FIND_MIN_GAP = 15;
export const LAB_FIND_MIN_SAMPLE = 5;
export const LAB_FIND_MIN_GROUPS = 3;

export function selectLabFindSide(over: LabSideResult, under: LabSideResult): LabFindSide {
  if (Math.min(over.sampleSize, under.sampleSize) < LAB_FIND_MIN_SAMPLE) return null;
  const winner =
    over.internalScore >= under.internalScore ? ['OVER', over, under] : ['UNDER', under, over];
  const [side, best, other] = winner as ['OVER' | 'UNDER', LabSideResult, LabSideResult];
  return best.internalScore >= LAB_FIND_MIN_SCORE &&
    best.internalScore - other.internalScore >= LAB_FIND_MIN_GAP &&
    best.supportingGroups >= LAB_FIND_MIN_GROUPS
    ? side
    : null;
}

type MarketInput = {
  playerId: string | null;
  marketType: string;
  statId?: string;
  line: number | null;
  side: string;
};

const clamp = (value: number) => Math.max(0, Math.min(100, value));
const fmt = (value: number | null, suffix = '') =>
  value === null ? 'Unavailable' : `${Math.round(value * 10) / 10}${suffix}`;

export function evaluatePropSides(
  market: MarketInput,
  games: HistoricalPlayerGame[],
  currentOpponentId?: string,
) {
  const statType =
    normalizeHistoricalStatType(market.marketType) ??
    normalizeHistoricalStatType(market.statId ?? '');
  if (!market.playerId || market.line === null || !statType)
    return { labFindSide: null as LabFindSide, over: null, under: null };

  const consistency = calculatePlayerConsistency(games, statType);
  const usage = calculatePlayerUsageTrend(games, statType);
  const calculate = (side: 'OVER' | 'UNDER'): LabSideResult => {
    const trend = calculatePlayerPropTrend(games, {
      playerId: market.playerId!,
      statType,
      line: market.line!,
      side,
      currentOpponentId,
    });
    const margin = calculateLineMargin(games, statType, market.line!, side);
    const recent =
      trend.last5.hitRate === null || trend.last10.hitRate === null
        ? null
        : trend.last5.hitRate * 0.4 + trend.last10.hitRate * 0.6;
    const marginScale = [
      'RECEPTIONS',
      'PASSING_TDS',
      'RUSHING_TDS',
      'RECEIVING_TDS',
      'ANYTIME_TD',
    ].includes(statType)
      ? 2
      : Math.max(Math.abs(market.line!) * 0.2, 5);
    const signals = [
      {
        label: 'Recent form',
        value: `${trend.last10.hits}/${trend.last10.games} last 10`,
        score: recent,
        weight: 25,
      },
      {
        label: 'Line cushion',
        value: `${fmt(margin.averageMargin, statType.includes('YARDS') ? ' yds' : '')} average`,
        score:
          margin.averageMargin === null
            ? null
            : clamp(50 + (margin.averageMargin / marginScale) * 35),
        weight: 20,
      },
      {
        label: `${usage.primaryMetric} trend`,
        value:
          usage.trendPct === null
            ? 'Unavailable'
            : `${usage.trendPct > 0 ? '+' : ''}${usage.trendPct}%`,
        score:
          usage.trendPct === null
            ? null
            : clamp(50 + (side === 'OVER' ? usage.trendPct : -usage.trendPct) * 1.5),
        weight: 15,
      },
      {
        label: 'Consistency',
        value: consistency?.label ?? 'Unavailable',
        score:
          recent === null || !consistency
            ? null
            : clamp(50 + ((recent - 50) * consistency.score) / 100),
        weight: 15,
      },
      {
        label: 'Vs. opponent',
        value: `${trend.vsOpponent.hits}/${trend.vsOpponent.games}`,
        score: trend.vsOpponent.games >= 2 ? trend.vsOpponent.hitRate : null,
        weight: 10,
      },
      {
        label: 'Two-year history',
        value: `${trend.last2Years.hits}/${trend.last2Years.games}`,
        score: trend.last2Years.hitRate,
        weight: 15,
      },
    ].filter((signal): signal is LabSignal & { weight: number } => signal.score !== null);
    const weight = signals.reduce((sum, signal) => sum + signal.weight, 0);
    const internalScore = weight
      ? Math.round(signals.reduce((sum, signal) => sum + signal.score * signal.weight, 0) / weight)
      : 0;
    return {
      sampleSize: trend.last2Years.games,
      internalScore,
      supportingGroups: signals.filter((signal) => signal.score >= 65).length,
      positiveSignals: signals
        .filter((signal) => signal.score >= 65)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5),
      concerns: signals
        .filter((signal) => signal.score <= 35)
        .sort((a, b) => a.score - b.score)
        .slice(0, 1),
    };
  };
  const over = calculate('OVER'),
    under = calculate('UNDER');
  return { labFindSide: selectLabFindSide(over, under), over, under };
}
