import { isAnytimeTD } from './anytime-td';
import type { HomeMarket } from './research';
export const PRIMARY_MARKETS = [
  ['ALL', 'All Props'],
  ['PASSING', 'Passing'],
  ['RUSHING', 'Rushing'],
  ['RECEIVING', 'Receiving'],
  ['TOUCHDOWN', 'Touchdowns'],
  ['KICKERS', 'Kicking'],
  ['DEFENSIVE', 'Defense'],
  ['SPECIALS', 'Game Specials'],
] as const;
const marketDefinitions = [
  ['PASSING_YARDS', 'Passing Yards', ['PASSING']],
  ['PASSING_TD', 'Passing TDs', ['PASSING', 'TOUCHDOWN']],
  ['PASSING_COMPLETIONS', 'Completions', ['PASSING']],
  ['PASSING_ATTEMPTS', 'Attempts', ['PASSING']],
  ['PASSING_INTERCEPTIONS', 'Interceptions', ['PASSING']],
  ['PASSING_RUSHING_YARDS', 'Passing + Rushing Yards', ['PASSING', 'RUSHING']],
  ['PASSING_LONGEST_COMPLETION', 'Longest Completion', ['PASSING']],
  ['RUSHING_YARDS', 'Rushing Yards', ['RUSHING']],
  ['RUSHING_ATTEMPTS', 'Rushing Attempts', ['RUSHING']],
  ['RUSHING_TD', 'Rushing TDs', ['RUSHING', 'TOUCHDOWN']],
  ['RUSHING_LONGEST_RUSH', 'Longest Rush', ['RUSHING']],
  ['RECEIVING_YARDS', 'Receiving Yards', ['RECEIVING']],
  ['RECEPTIONS', 'Receptions', ['RECEIVING']],
  ['RECEIVING_TD', 'Receiving TDs', ['RECEIVING', 'TOUCHDOWN']],
  ['RUSHING_RECEIVING_YARDS', 'Rushing + Receiving Yards', ['RECEIVING', 'RUSHING']],
  ['RECEIVING_LONGEST_RECEPTION', 'Longest Reception', ['RECEIVING']],
  ['ANYTIME_TD', 'Anytime TD', ['TOUCHDOWN']],
  ['TOUCHDOWNS', 'Total Touchdowns', ['TOUCHDOWN']],
  ['KICKING_POINTS', 'Kicking Points', ['KICKERS']],
  ['EXTRA_POINTS_MADE', 'Extra Points', ['KICKERS']],
  ['FIELD_GOALS_MADE', 'Field Goals', ['KICKERS']],
  ['COMBINED_TACKLES', 'Tackles + Assists', ['DEFENSIVE']],
  ['SOLO_TACKLES', 'Solo Tackles', ['DEFENSIVE']],
  ['ASSISTED_TACKLES', 'Assisted Tackles', ['DEFENSIVE']],
  ['SACKS', 'Sacks', ['DEFENSIVE']],
] as const;
export const specificMarket = (m: HomeMarket) => (isAnytimeTD(m) ? 'ANYTIME_TD' : m.marketType);
export function propMarketLabel(m: HomeMarket) {
  return (
    marketDefinitions.find(([key]) => key === specificMarket(m))?.[1] ??
    m.marketType
      .replaceAll('_', ' ')
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase())
  );
}
export type MarketFacet = { id: string; label: string; categories: string[] };
/** Facets come from available records, never a synthetic list of offered markets. */
export function availableMarketFacets(markets: HomeMarket[]): MarketFacet[] {
  const ids = new Set(markets.map(specificMarket));
  const known = marketDefinitions
    .filter(([id]) => ids.has(id))
    .map(([id, label, categories]) => ({ id, label, categories: [...categories] as string[] }));
  return [
    ...known,
    ...[...ids]
      .filter((id) => !known.some((m) => m.id === id))
      .sort()
      .map((id) => ({
        id,
        label: propMarketLabel({ marketType: id } as HomeMarket),
        categories: ['SPECIALS'],
      })),
  ];
}
export function primaryMarketOptions(facets: MarketFacet[]) {
  return PRIMARY_MARKETS.filter(
    ([id]) => id === 'ALL' || facets.some((f) => f.categories.includes(id)),
  );
}
export function secondaryMarketOptions(facets: MarketFacet[], category: string) {
  const name = PRIMARY_MARKETS.find(([id]) => id === category)?.[1] ?? 'Markets';
  return [
    { id: 'ALL', label: category === 'ALL' ? 'All Markets' : `All ${name}` },
    ...facets.filter((f) => category === 'ALL' || f.categories.includes(category)),
  ];
}
export function matchesMarketNavigation(
  m: HomeMarket,
  category: string,
  market: string,
  facets: MarketFacet[],
) {
  const id = specificMarket(m);
  return (
    (category === 'ALL' || facets.find((f) => f.id === id)?.categories.includes(category)) &&
    (market === 'ALL' || id === market)
  );
}

/** URL values are case-insensitive; ALL is represented by an absent parameter. */
export function readMarketNavigation(
  params: Pick<URLSearchParams, 'get'>,
  facets?: MarketFacet[],
): { category: string; market: string } {
  const requestedCategory = (params.get('category') ?? 'ALL').toUpperCase();
  const category = PRIMARY_MARKETS.some(([id]) => id === requestedCategory)
    ? requestedCategory
    : 'ALL';
  const requestedMarket = (params.get('market') ?? 'ALL').toUpperCase();
  const supported =
    facets ??
    marketDefinitions.map(([id, label, categories]) => ({
      id,
      label,
      categories: [...categories] as string[],
    }));
  const market =
    category !== 'ALL' &&
    supported.some((m) => m.id === requestedMarket && m.categories.includes(category))
      ? requestedMarket
      : 'ALL';
  return { category, market };
}
export function writeMarketNavigation(params: URLSearchParams, category: string, market = 'ALL') {
  const next = new URLSearchParams(params);
  if (category === 'ALL') {
    next.delete('category');
    next.delete('market');
  } else {
    next.set('category', category.toLowerCase());
    if (market === 'ALL') next.delete('market');
    else next.set('market', market.toLowerCase());
  }
  return next;
}
