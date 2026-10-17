import { isAnytimeTD, researchSide } from './anytime-td';
import { decimalOdds } from './betting-value';
import { bettingOpportunityRank, isTrendingEligible } from './trending-selection';
import type { DiscoveryPreferences } from './discovery-preferences';
import type { HomeMarket } from './research';
type DiscoveryMarket = Pick<
  HomeMarket,
  'marketType' | 'side' | 'line' | 'odds' | 'available' | 'sportsbook'
> &
  Partial<Pick<HomeMarket, 'eventId' | 'playerId' | 'period' | 'lineType'>> & {
    trend?: Pick<NonNullable<HomeMarket['trend']>, 'trendScore' | 'projection'> | null;
  };
export const discoveryLineMode = (p: DiscoveryPreferences) => (p.altLines ? 'all' : 'standard');
export function matchesDiscoveryMode(m: DiscoveryMarket, p: DiscoveryPreferences) {
  return (
    m.available &&
    m.playerId &&
    m.period === 'game' &&
    (isAnytimeTD(m) || (Number.isFinite(m.line) && m.line != null)) &&
    decimalOdds(m.odds) != null &&
    (isAnytimeTD(m) || m.lineType === 'main' || (p.altLines && m.lineType === 'alternate')) &&
    (!p.altLines || m.odds! >= p.maxOdds)
  );
}
/** Confidence discovery retains role safeguards, but does not confuse expensive odds with low confidence. */
export function supportsDiscovery(m: DiscoveryMarket, p: DiscoveryPreferences) {
  if (!p.altLines) return isTrendingEligible(m);
  const projection = m.trend?.projection;
  return (
    !!projection &&
    projection.estimatedProbability != null &&
    projection.recommendation === researchSide(m.side) &&
    projection.dataQuality.currentRoleKnown &&
    projection.dataQuality.reliability >= 0.6 &&
    (projection.modelScore ?? m.trend?.trendScore ?? 0) >= 60
  );
}
export function selectDiscoveryMarkets<T extends DiscoveryMarket>(
  markets: T[],
  preferences: DiscoveryPreferences,
  options: { sportsbook?: string; includeUnqualified?: boolean; sort?: 'score' | 'value' } = {},
): T[] {
  const unique = new Map<string, T>();
  for (const m of markets) {
    if (
      !matchesDiscoveryMode(m, preferences) ||
      (options.sportsbook && options.sportsbook !== 'ALL' && m.sportsbook !== options.sportsbook) ||
      (!options.includeUnqualified && !supportsDiscovery(m, preferences))
    )
      continue;
    const key = [m.eventId, m.playerId, m.marketType, m.period, m.side, m.line].join('|');
    const previous = unique.get(key);
    if (!previous || decimalOdds(m.odds)! > decimalOdds(previous.odds)!) unique.set(key, m);
  }
  return [...unique.values()].sort(
    (a, b) =>
      (options.sort === 'value'
        ? bettingOpportunityRank(b) - bettingOpportunityRank(a)
        : (b.trend?.trendScore ?? -1) - (a.trend?.trendScore ?? -1)) ||
      decimalOdds(b.odds)! - decimalOdds(a.odds)! ||
      String(a.playerId).localeCompare(String(b.playerId)) ||
      a.line! - b.line!,
  );
}
