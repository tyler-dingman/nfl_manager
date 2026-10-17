import { isAnytimeTD } from './anytime-td';
/** Stat units shared by web table cells and native prop cards. */
const units: Record<string, string> = {
  PASSING_YARDS: 'yards',
  PASSING_RUSHING_YARDS: 'yards',
  RUSHING_YARDS: 'yards',
  RECEIVING_YARDS: 'yards',
  RUSHING_RECEIVING_YARDS: 'yards',
  PASSING_LONGEST_COMPLETION: 'yards',
  RUSHING_LONGEST_RUSH: 'yards',
  RECEIVING_LONGEST_RECEPTION: 'yards',
  PASSING_COMPLETIONS: 'completions',
  PASSING_ATTEMPTS: 'attempts',
  RUSHING_ATTEMPTS: 'attempts',
  RECEPTIONS: 'receptions',
  PASSING_TD: 'touchdowns',
  RUSHING_TD: 'touchdowns',
  TOUCHDOWNS: 'touchdowns',
  PASSING_INTERCEPTIONS: 'interceptions',
  COMBINED_TACKLES: 'tackles',
  SOLO_TACKLES: 'tackles',
  ASSISTED_TACKLES: 'assists',
  SACKS: 'sacks',
  KICKING_POINTS: 'points',
  EXTRA_POINTS_MADE: 'extra points',
  TOTAL: 'points',
  SPREAD: 'points',
};
export function formatProjection(market: {
  marketType: string;
  side?: string;
  line?: number | null;
  trend?: {
    projection?: { projection: number | null; estimatedProbability?: number | null } | null;
  } | null;
}) {
  if (isAnytimeTD({ ...market, side: market.side ?? '', line: market.line ?? null })) {
    const probability = market.trend?.projection?.estimatedProbability;
    return probability == null ? '—' : `${Number((probability * 100).toFixed(1))}%`;
  }
  const value = market.trend?.projection?.projection;
  if (value == null || !Number.isFinite(value)) return '—';
  return `${Number(value.toFixed(1))}${units[market.marketType] ? ` ${units[market.marketType]}` : ''}`;
}
