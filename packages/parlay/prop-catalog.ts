import { availableMarketFacets, matchesMarketNavigation } from './market-navigation';
import { groupPropSelections } from './prop-groups';
import type { HomeMarket, OddsEvent } from './research';
import { isAnytimeTD, researchSide } from './anytime-td';
import { selectDiscoveryMarkets } from './discovery-selection';
import { matchesPropSearch } from './search';
import { decimalOdds } from './betting-value';
export const PROP_CATEGORIES = [
  ['ALL', 'All Props'],
  ['PASSING', 'Passing'],
  ['RUSHING', 'Rushing'],
  ['RECEIVING', 'Receiving'],
  ['TOUCHDOWN', 'TDs'],
  ['ANYTIME_TD', 'Anytime TD'],
  ['YARDS', 'Yards'],
  ['RECEPTIONS', 'Receptions'],
  ['KICKERS', 'Kickers'],
  ['DEFENSIVE', 'Defensive'],
];
export const PROP_SORTS = [
  ['score', 'Highest Lab Score'],
  ['score-low', 'Lowest Lab Score'],
  ['edge', 'Best Projection Edge'],
  ['odds', 'Highest Odds'],
  ['odds-low', 'Lowest Odds'],
  ['name', 'Player Name'],
  ['time', 'Game Time'],
];
export function matchesPropCategory(m: HomeMarket, category: string) {
  const name = `${m.marketType} ${m.statId}`.toUpperCase();
  switch (category) {
    case 'ALL':
      return true;
    case 'ANYTIME_TD':
      return isAnytimeTD(m);
    case 'PASSING':
      return name.includes('PASS');
    case 'RUSHING':
      return name.includes('RUSH');
    case 'RECEIVING':
      return /RECEIV|RECEPTION/.test(name);
    case 'TOUCHDOWN':
      return /TOUCHDOWN|(^|_)TD($|_)/.test(name);
    case 'YARDS':
      return name.includes('YARD');
    case 'RECEPTIONS':
      return name.includes('RECEPTION');
    case 'KICKERS':
      return /FIELD_GOAL|KICKING|EXTRA_POINT/.test(name);
    case 'DEFENSIVE':
      return /TACKLE|SACK|PASS_DEFEND/.test(name);
    default:
      return m.marketType === category;
  }
}
export function catalogScore(m: HomeMarket) {
  return m.trend?.projection && m.trend.projection.estimatedProbability == null
    ? null
    : (m.trend?.trendScore ?? null);
}
export function queryPropCatalog(
  markets: HomeMarket[],
  events: OddsEvent[],
  query: URLSearchParams,
) {
  const active = events.filter((e) => !e.marketsLocked && Date.parse(e.kickoffAt) > Date.now());
  const eventMap = new Map(active.map((e) => [e.id, e]));
  const valid = markets.filter((m) => eventMap.has(m.eventId ?? ''));
  const universe = selectDiscoveryMarkets(
    valid,
    { altLines: true, maxOdds: -Number.MAX_VALUE },
    { includeUnqualified: true },
  );
  const scores = universe.map(catalogScore).filter((v): v is number => v != null);
  const stats = {
    props: universe.length,
    players: new Set(universe.map((m) => m.playerId)).size,
    games: new Set(universe.map((m) => m.eventId)).size,
    highestScore: scores.length ? Math.max(...scores) : null,
  };
  const facets = availableMarketFacets(universe);
  const grouped = query.get('grouped') === 'true';
  const trending = query.get('view') === 'trends';
  const maxOdds = Number(query.get('maxOdds') ?? -1000);
  const rows = selectDiscoveryMarkets(
    valid,
    {
      altLines: query.get('altLines') === 'true',
      maxOdds: Number.isFinite(maxOdds) ? Math.max(-1000, maxOdds) : -1000,
    },
    { includeUnqualified: !trending, sportsbook: query.get('book') ?? 'ALL' },
  ).filter(
    (m) =>
      (!query.get('game') || query.get('game') === 'ALL' || m.eventId === query.get('game')) &&
      (!query.get('team') || query.get('team') === 'ALL' || m.teamId === query.get('team')) &&
      matchesPropSearch(m.playerName, query.get('search') ?? '') &&
      (grouped
        ? matchesMarketNavigation(
            m,
            query.get('category') ?? 'ALL',
            query.get('market') ?? 'ALL',
            facets,
          )
        : matchesPropCategory(m, query.get('category') ?? 'ALL')) &&
      (!query.get('side') ||
        query.get('side') === 'ALL' ||
        researchSide(m.side) === query.get('side')),
  );
  const sort = query.get('sort') ?? 'score';
  const descending = query.get('direction') !== 'asc';
  const numeric = (m: HomeMarket): number | null | undefined => {
    switch (sort) {
      case 'odds':
      case 'odds-low':
        return decimalOdds(m.odds);
      case 'edge':
        return m.trend?.projection?.edge == null
          ? null
          : (researchSide(m.side) === 'UNDER' ? -1 : 1) * m.trend.projection.edge;
      case 'time':
      case 'game':
        return Date.parse(eventMap.get(m.eventId!)!.kickoffAt);
      case 'line':
        return m.line;
      case 'projection':
        return isAnytimeTD(m)
          ? m.trend?.projection?.estimatedProbability
          : m.trend?.projection?.projection;
      case 'last10':
        return m.trend?.last10.hitRate;
      default:
        return catalogScore(m);
    }
  };
  rows.sort((a, b) => {
    if (['name', 'player', 'prop'].includes(sort))
      return (
        (sort === 'prop'
          ? a.marketType.localeCompare(b.marketType)
          : (a.playerName ?? '').localeCompare(b.playerName ?? '')) *
        (query.get('direction') === 'desc' ? -1 : 1)
      );
    const av = numeric(a),
      bv = numeric(b);
    if (av == null || bv == null)
      return av == null ? (bv == null ? a.id.localeCompare(b.id) : 1) : -1;
    const asc = ['score-low', 'odds-low', 'time'].includes(sort) || !descending;
    return (
      (asc ? av - bv : bv - av) ||
      decimalOdds(b.odds)! - decimalOdds(a.odds)! ||
      a.id.localeCompare(b.id)
    );
  });
  const allGroups = groupPropSelections(rows);
  const total = rows.length;
  const totalGroups = allGroups.length;
  const pages = Math.max(1, Math.ceil((grouped ? totalGroups : total) / 12));
  const page = Math.min(pages, Math.max(1, Math.floor(Number(query.get('page'))) || 1));
  const groups = allGroups.slice((page - 1) * 12, page * 12);
  const featuredPlayers = new Set<string>();
  const featured = selectDiscoveryMarkets(valid, {
    altLines: query.get('altLines') === 'true',
    maxOdds: Number.isFinite(maxOdds) ? Math.max(-1000, maxOdds) : -1000,
  })
    .filter((m) => {
      if (!m.playerId || featuredPlayers.has(m.playerId)) return false;
      featuredPlayers.add(m.playerId);
      return true;
    })
    .slice(0, 3);
  return {
    groups,
    totalGroups,
    facets,
    featured,
    markets: grouped ? groups.flatMap((g) => g.selections) : rows.slice((page - 1) * 12, page * 12),
    total,
    page,
    pages,
    stats,
    events: active,
    books: [...new Set(valid.map((m) => m.sportsbook))].sort(),
  };
}
export type CatalogProgress = { complete: boolean; loadedEvents: number; totalEvents: number };
export type PropCatalogPage = ReturnType<typeof queryPropCatalog> & { progress?: CatalogProgress };
