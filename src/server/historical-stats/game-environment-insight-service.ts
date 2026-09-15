import { formatLineLadderThreshold } from '@/lib/parlay-lab/market-display';
import { gameWindowLabel, type GameEnvironment } from './game-environment-service';
import type { EnvironmentSplit } from './player-environment-trend-service';

type Splits = Record<string, EnvironmentSplit>;
export type RelevantEnvironmentSplit = { key: string; label: string; value: EnvironmentSplit };
const splitInfo: Record<string, string> = {
  day: 'Day Games',
  night: 'Night Games',
  primetime: 'Primetime',
  thursdayNight: 'Thursday Night',
  sundayNight: 'Sunday Night',
  mondayNight: 'Monday Night',
  sundayEarly: 'Sunday Early',
  sundayLate: 'Sunday Late',
  shortRest: 'Short Rest',
  normalRest: 'Normal Rest',
  extendedRest: 'Extended Rest',
};
export function relevantEnvironmentSplits(current: GameEnvironment, splits: Splits) {
  const keys = [
    ...(current.isPrimetime ? ['primetime'] : []),
    current.primetimeType === 'TNF'
      ? 'thursdayNight'
      : current.primetimeType === 'SNF'
        ? 'sundayNight'
        : current.primetimeType === 'MNF'
          ? 'mondayNight'
          : null,
    current.isNightGame ? 'night' : 'day',
    current.gameWindow === 'SUNDAY_EARLY'
      ? 'sundayEarly'
      : current.gameWindow === 'SUNDAY_LATE'
        ? 'sundayLate'
        : null,
    current.restBucket === 'SHORT_REST'
      ? 'shortRest'
      : current.restBucket === 'NORMAL_REST'
        ? 'normalRest'
        : current.restBucket === 'EXTENDED_REST'
          ? 'extendedRest'
          : null,
  ].filter((key): key is string => Boolean(key));
  return [...new Set(keys)].map((key) => ({ key, label: splitInfo[key]!, value: splits[key]! }));
}
export function buildGameEnvironmentInsights(
  playerName: string,
  statType: string,
  line: number,
  side: 'OVER' | 'UNDER',
  relevant: RelevantEnvironmentSplit[],
) {
  const threshold = formatLineLadderThreshold(statType, line, side);
  return relevant
    .filter(({ value }) => value.games >= 3 && value.hitRate !== null)
    .sort((a, b) => b.value.games - a.value.games)
    .slice(0, 2)
    .map(({ label, value }) => ({
      label:
        label === 'Primetime'
          ? 'Primetime check'
          : label === 'Short Rest'
            ? 'Short rest caution'
            : `${label} trend`,
      text: `${playerName} has cleared ${threshold} in ${value.hits} of ${value.games} ${label.toLowerCase()} games in the two-year sample.`,
    }));
}
export const currentEnvironmentLabel = (current: GameEnvironment) =>
  gameWindowLabel(current.gameWindow);
