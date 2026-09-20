import type { ScoreContext } from './research-score';
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

export function evaluatePropSides(
  market: MarketInput,
  games: HistoricalPlayerGame[],
  currentOpponentId?: string,
  context: ScoreContext = {},
) {
  const statType =
    normalizeHistoricalStatType(market.marketType) ??
    normalizeHistoricalStatType(market.statId ?? '');
  if (!market.playerId || market.line === null || !statType)
    return { labFindSide: null as LabFindSide, over: null, under: null };

  const calculate = (side: 'OVER' | 'UNDER'): LabSideResult => {
    const trend = calculatePlayerPropTrend(games, {
      playerId: market.playerId!,
      statType,
      line: market.line!,
      side,
      currentOpponentId,
      ...context,
    });
    const research = trend.researchScore;
    const groups = research.breakdown;
    const signals = [
      {
        label: 'Historical evidence',
        value: research.lineContext.scoreBasis,
        score: 50 + groups.historical.adjustment,
      },
      ...(groups.usage.alignment === 'unknown'
        ? []
        : [
            {
              label: 'Usage',
              value: groups.usage.alignment,
              score: 50 + groups.usage.adjustment * 8,
            },
          ]),
      ...(groups.matchup.alignment === 'unknown'
        ? []
        : [
            {
              label: 'Matchup',
              value: research.matchup.label,
              score: 50 + groups.matchup.adjustment * 5,
            },
          ]),
      ...(groups.gameContext.alignment === 'unknown'
        ? []
        : [
            {
              label: 'Game context',
              value: groups.gameContext.alignment,
              score: 50 + groups.gameContext.adjustment * 15,
            },
          ]),
    ];
    const internalScore = research.score;
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
        .slice(0, 3),
    };
  };
  const over = calculate('OVER'),
    under = calculate('UNDER');
  return { labFindSide: selectLabFindSide(over, under), over, under };
}
