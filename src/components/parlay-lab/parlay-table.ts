export type SortDirection = 'asc' | 'desc';
export type SortState<Key extends string = string> = { key: Key; direction: SortDirection } | null;
export type OddsFilter = 'ALL' | '-500' | '-300' | '-200' | '-150' | '-120' | 'PLUS' | 'CUSTOM';

export function americanOddsToDecimal(odds: number) {
  return odds > 0 ? 1 + odds / 100 : 1 + 100 / Math.abs(odds);
}

export function americanOddsToImpliedProbability(odds: number) {
  return odds > 0 ? 100 / (odds + 100) : Math.abs(odds) / (Math.abs(odds) + 100);
}

export function compareAmericanOdds(left: number, right: number) {
  return americanOddsToDecimal(left) - americanOddsToDecimal(right);
}

export function parseHitRate(value: string) {
  const match = value.match(/^\s*(\d+)\s*\/\s*(\d+)\s*$/);
  if (!match) return null;
  const hits = Number(match[1]);
  const games = Number(match[2]);
  return { hits, games, rate: games ? hits / games : 0 };
}

export function hitRateSortValue(hits: number, games: number) {
  return games ? hits / games + games / 1_000_000 : 0;
}

export function nextSort<Key extends string>(current: SortState<Key>, key: Key): SortState<Key> {
  if (!current || current.key !== key) return { key, direction: 'asc' };
  if (current.direction === 'asc') return { key, direction: 'desc' };
  return null;
}

export function matchesOddsFilter(
  odds: number | null | undefined,
  filter: OddsFilter,
  minimum?: number | null,
  maximum?: number | null,
) {
  if (filter === 'ALL') return true;
  if (odds == null) return false;
  if (filter === 'PLUS') return odds >= 100;
  if (filter === 'CUSTOM') {
    if (minimum != null && odds < minimum) return false;
    if (maximum != null && odds > maximum) return false;
    return true;
  }
  return compareAmericanOdds(odds, Number(filter)) >= 0;
}

type SortValue = string | number | null | undefined;
export function sortTableRows<Row, Key extends string>(
  rows: Row[],
  sort: SortState<Key>,
  accessors: Record<Key, (row: Row) => SortValue>,
) {
  if (!sort) return [...rows];
  const accessor = accessors[sort.key];
  return [...rows].sort((left, right) => {
    const a = accessor(left);
    const b = accessor(right);
    if (a == null && b == null) return 0;
    if (a == null) return 1;
    if (b == null) return -1;
    const comparison =
      typeof a === 'string' && typeof b === 'string' ? a.localeCompare(b) : Number(a) - Number(b);
    return sort.direction === 'asc' ? comparison : -comparison;
  });
}
