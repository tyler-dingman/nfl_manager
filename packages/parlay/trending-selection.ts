import { researchSide } from './anytime-td';
import { LAB_SCORE_CONFIG } from './lab-score-config';
import { bettingValue } from './betting-value';
type RankedMarket = {
  odds?: number | null;
  trend?: {
    trendScore: number;
    projection?: {
      modelScore?: number;
      projection: number | null;
      recommendation: string | null;
      estimatedProbability?: number | null;
      pushProbability?: number | null;
      dataQuality?: { reliability: number; freshness: number; currentRoleKnown?: boolean };
    };
  } | null;
};
export function bettingOpportunityRank(m: RankedMarket) {
  const p = m.trend?.projection;
  const value = bettingValue(p?.estimatedProbability ?? null, p?.pushProbability ?? null, m.odds);
  return (
    (p?.modelScore ?? m.trend?.trendScore ?? 0) * 0.6 +
    (value.expectedReturn == null ? -20 : Math.max(-1, Math.min(0.5, value.expectedReturn)) * 40) +
    (p?.dataQuality?.reliability ?? 0) * 10 +
    (p?.dataQuality?.freshness ?? 0) * 5 -
    (value.extremePrice ? 50 : 0)
  );
}
export function isTrendingEligible(m: RankedMarket & { side: string }) {
  const p = m.trend?.projection;
  const value = bettingValue(p?.estimatedProbability ?? null, p?.pushProbability ?? null, m.odds);
  return (
    !!p &&
    p.projection != null &&
    p.recommendation === researchSide(m.side) &&
    (p?.modelScore ?? m.trend?.trendScore ?? 0) >= LAB_SCORE_CONFIG.trending.minimumScore &&
    p.estimatedProbability != null &&
    p.dataQuality?.currentRoleKnown === true &&
    (p.dataQuality?.reliability ?? 0) >= 0.6 &&
    value.expectedReturn != null &&
    value.expectedReturn > -0.05 &&
    !value.extremePrice
  );
}
export function representativeTrends<
  T extends {
    eventId?: string;
    playerId?: string | null;
    marketType: string;
    period?: string;
    side: string;
    lineType?: string;
    odds?: number | null;
    trend?: { trendScore: number } | null;
  },
>(markets: T[]) {
  const groups = new Map<string, T>();
  for (const market of markets) {
    const key = [
      market.eventId,
      market.playerId,
      market.marketType,
      market.period,
      market.side,
    ].join('|');
    const old = groups.get(key);
    if (!old) {
      groups.set(key, market);
      continue;
    }
    const value = (m: T) => bettingOpportunityRank(m) + (m.lineType === 'main' ? 2 : 0);
    if (value(market) > value(old)) groups.set(key, market);
  }
  return [...groups.values()];
}

/** Quality first; the 70/30 preference only orders eligible opportunities, never pads a weak slate. */
export function rankTrendingProps<
  T extends {
    side: string;
    trend?: {
      trendScore: number;
      projection?: {
        modelScore?: number;
        projection: number | null;
        recommendation: string | null;
      };
    } | null;
  },
>(markets: T[]): T[] {
  const ranked = [...markets].sort((a, b) => bettingOpportunityRank(b) - bettingOpportunityRank(a));
  const supported = (m: T) => isTrendingEligible(m);
  const overs = ranked.filter((m) => researchSide(m.side) === 'OVER' && supported(m));
  const unders = ranked.filter((m) => researchSide(m.side) === 'UNDER' && supported(m));
  const selected: T[] = [];
  let o = 0,
    u = 0;
  while (o < overs.length || u < unders.length) {
    const wantOver = o < Math.round((selected.length + 1) * LAB_SCORE_CONFIG.trending.overShare);
    if ((wantOver && o < overs.length) || u >= unders.length) selected.push(overs[o++]!);
    else selected.push(unders[u++]!);
  }
  return selected;
}
