import { SPORTSBOOKS, type Sportsbook } from '@/server/odds/sportsbooks';

export type FitMarket = {
  id: string;
  sportsbook: Sportsbook;
  odds: number | null;
  available: boolean;
  deeplink: string | null;
};

export type SportsbookFit = {
  sportsbook: (typeof SPORTSBOOKS)[number];
  matchedLegs: number;
  totalLegs: number;
  coveragePct: number;
  missingLegIds: string[];
  prices: Array<number | null>;
  priceQuality: number;
  deeplinkAvailable: boolean;
};

export function rankSportsbookFits(legs: FitMarket[], markets: FitMarket[]): SportsbookFit[] {
  const legIds = [...new Set(legs.map((leg) => leg.id))];
  const bestByLeg = new Map(
    legIds.map((id) => [
      id,
      Math.max(
        ...markets
          .filter((market) => market.id === id && market.available && market.odds !== null)
          .map((market) => market.odds!),
        -100000,
      ),
    ]),
  );
  return SPORTSBOOKS.map((sportsbook) => {
    const matches = legIds.map((id) =>
      markets.find(
        (market) => market.id === id && market.sportsbook === sportsbook.id && market.available,
      ),
    );
    const available = matches.filter((market): market is FitMarket => Boolean(market));
    const priceQuality = available.reduce((score, market) => {
      if (market.odds === null) return score;
      return score + market.odds - (bestByLeg.get(market.id) ?? market.odds);
    }, 0);
    return {
      sportsbook,
      matchedLegs: available.length,
      totalLegs: legIds.length,
      coveragePct: legIds.length ? Math.round((available.length / legIds.length) * 100) : 0,
      missingLegIds: legIds.filter((id) => !matches[legIds.indexOf(id)]),
      prices: matches.map((market) => market?.odds ?? null),
      priceQuality,
      deeplinkAvailable: available.some((market) => Boolean(market.deeplink)),
    };
  }).sort(
    (left, right) =>
      right.matchedLegs - left.matchedLegs ||
      right.priceQuality - left.priceQuality ||
      Number(right.deeplinkAvailable) - Number(left.deeplinkAvailable),
  );
}
