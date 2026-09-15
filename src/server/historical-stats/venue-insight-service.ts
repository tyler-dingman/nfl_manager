import { formatLineLadderThreshold } from '@/lib/parlay-lab/market-display';

type Split = { games: number; hits: number; hitRate: number | null };
export const MIN_VENUE_INSIGHT_GAMES = 3;
export const MIN_VENUE_RATE_DIFFERENCE = 15;
export function buildVenueInsight(
  playerName: string,
  statType: string,
  line: number,
  side: 'OVER' | 'UNDER',
  current: 'INDOOR' | 'OUTDOOR' | 'UNKNOWN',
  indoor: Split,
  outdoor: Split,
) {
  if (current === 'UNKNOWN') return null;
  const matching = current === 'INDOOR' ? indoor : outdoor,
    other = current === 'INDOOR' ? outdoor : indoor,
    place = current === 'INDOOR' ? 'indoor' : 'outdoor',
    threshold = formatLineLadderThreshold(statType, line, side);
  if (matching.games < MIN_VENUE_INSIGHT_GAMES || matching.hitRate === null) return null;
  if (
    other.games >= MIN_VENUE_INSIGHT_GAMES &&
    other.hitRate !== null &&
    Math.abs(matching.hitRate - other.hitRate) >= MIN_VENUE_RATE_DIFFERENCE
  )
    return `${playerName} has cleared ${threshold} in ${matching.hits} of ${matching.games} ${place} games, compared with ${other.hits} of ${other.games} ${place === 'indoor' ? 'outdoor' : 'indoor'} games in this sample.`;
  if (matching.hitRate < 50)
    return `One thing to watch: ${playerName} has cleared ${threshold} in only ${matching.hits} of ${matching.games} ${place} games in this sample.`;
  return `${playerName} has cleared ${threshold} in ${matching.hits} of ${matching.games} ${place} games in this sample.`;
}
