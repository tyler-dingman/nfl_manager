import type { MarketType, NormalizedOddsMarket } from '../../odds/normalization';
import type { Sportsbook } from '../../odds/sportsbooks';
import type { ShadowSelection } from './coverage';
type Mappings = {
  events: ReadonlyMap<number, { id: string; kickoffAt: string }>;
  players: ReadonlyMap<number, { id: string; teamId: string }>;
  periods: ReadonlyMap<number, string>;
  markets: ReadonlyMap<
    number,
    {
      marketType: MarketType;
      statId: string;
      name: string;
      sides: Readonly<Record<number, string>>;
    }
  >;
  sources: ReadonlyMap<number, Sportsbook>;
};
export type MappedUnabatedMarket = Omit<NormalizedOddsMarket, 'prices'> & {
  eventId: string;
  prices: Array<
    NormalizedOddsMarket['prices'][number] & {
      provider: 'UNABATED';
      providerDeepLink: string | null;
      providerMarketId: string;
      providerSourceId: string;
      providerMarketLineId: string;
      sportsbookMarketId: string | null;
      sportsbookSelectionId: string | null;
      lineType: 'main' | 'alternate';
      providerModifiedAt: string | null;
      freshnessExpiresAt: string | null;
    }
  >;
};
/** Produces compact DB-ready rows with existing canonical identities, without writing.
 * Maps must come from reviewed discovery and event/roster mapping; unknowns are quarantined. */
export function normalizeUnabatedProps(rows: ShadowSelection[], maps: Mappings) {
  const grouped = new Map<string, MappedUnabatedMarket>();
  const rejected: Array<{ eventId: number; personId: number; reason: string }> = [];
  for (const row of rows) {
    const event = maps.events.get(row.eventId),
      player = maps.players.get(row.personId),
      period = maps.periods.get(row.periodTypeId),
      market = maps.markets.get(row.betTypeId),
      book = maps.sources.get(row.marketSourceId!);
    const side = market?.sides[row.sideIndex];
    if (
      !event ||
      !player ||
      !period ||
      !market ||
      !book ||
      !side ||
      row.marketId == null ||
      row.marketLineId == null ||
      row.points == null ||
      !Number.isFinite(row.points) ||
      (row.betSubType ?? '') !== '' ||
      Date.parse(event.kickoffAt) !== Date.parse(row.eventStart ?? '')
    ) {
      rejected.push({
        eventId: row.eventId,
        personId: row.personId,
        reason: 'Unverified mapping, kickoff, subtype, line, or identifier.',
      });
      continue;
    }
    const normalizedKey = [
      market.marketType.toLowerCase(),
      period.toLowerCase(),
      player.id.toLowerCase(),
      side.toLowerCase(),
      row.points,
    ].join(':');
    const key = event.id + '|' + normalizedKey;
    const stored: MappedUnabatedMarket = grouped.get(key) ?? {
      eventId: event.id,
      providerMarketId: String(row.marketId),
      marketType: market.marketType,
      statId: market.statId,
      entityId: String(row.personId),
      playerId: player.id,
      teamId: player.teamId,
      period,
      side,
      line: row.points,
      normalizedKey,
      isAltLine: row.lineType === 'alternate',
      providerMarketName: market.name,
      normalizationStatus: 'KNOWN' as const,
      rawProviderMetadata: {
        provider: 'UNABATED',
        betTypeId: row.betTypeId,
        periodTypeId: row.periodTypeId,
      },
      prices: [],
    };
    const price = {
      sportsbook: book,
      providerSelectionId: String(row.marketLineId),
      odds: row.price,
      line: row.points,
      available: row.available,
      // Keep generic links unpublished until account attribution is applied by the transfer service.
      deeplink: null,
      provider: 'UNABATED' as const,
      providerDeepLink: row.deepLink,
      providerMarketId: String(row.marketId),
      providerSourceId: String(row.marketSourceId),
      providerMarketLineId: String(row.marketLineId),
      sportsbookMarketId: row.sportsbookMarketId,
      sportsbookSelectionId: row.sportsbookSelectionId,
      lineType: row.lineType,
      providerModifiedAt: row.modifiedOn,
      freshnessExpiresAt: row.freshnessExpiresAt,
    };
    const prior = stored.prices.findIndex((p) => p.sportsbook === book);
    if (prior >= 0) {
      const previous = stored.prices[prior];
      const newer =
        Date.parse(price.providerModifiedAt ?? '') > Date.parse(previous.providerModifiedAt ?? '');
      if (newer) stored.prices[prior] = price;
      else if (JSON.stringify(previous) !== JSON.stringify(price)) {
        // Conflicting duplicate with no usable ordering is not an actionable offer.
        stored.prices[prior] = { ...previous, available: false };
        rejected.push({
          eventId: row.eventId,
          personId: row.personId,
          reason: 'Conflicting duplicate offer without a newer timestamp.',
        });
      }
    } else stored.prices.push(price);
    stored.isAltLine = stored.prices.every((p) => p.lineType === 'alternate');
    grouped.set(key, stored);
  }
  return { markets: [...grouped.values()], rejected };
}
