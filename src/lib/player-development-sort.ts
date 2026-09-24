import type { PlayerRowDTO } from '@/types/player';

export const DEVELOPMENT_COLUMNS = [
  'Player',
  'Position',
  'Age',
  'OVR',
  'Baseline',
  'Change',
] as const;
export type DevelopmentSortColumn = (typeof DEVELOPMENT_COLUMNS)[number];
type DevelopmentPlayer = Pick<
  PlayerRowDTO,
  'id' | 'firstName' | 'lastName' | 'position' | 'age' | 'rating' | 'baselineRating'
>;
const numeric = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;
export function ratingChange(player: DevelopmentPlayer) {
  const current = numeric(player.rating),
    baseline = numeric(player.baselineRating);
  return current !== null && baseline !== null ? current - baseline : null;
}
function value(player: DevelopmentPlayer, column: DevelopmentSortColumn) {
  switch (column) {
    case 'Player':
      return `${player.firstName} ${player.lastName}`;
    case 'Position':
      return player.position || null;
    case 'Age':
      return numeric(player.age);
    case 'OVR':
      return numeric(player.rating);
    case 'Baseline':
      return numeric(player.baselineRating);
    case 'Change':
      return ratingChange(player);
  }
}
export function compareDevelopmentPlayers(
  a: DevelopmentPlayer,
  b: DevelopmentPlayer,
  column: DevelopmentSortColumn,
  direction: 'asc' | 'desc',
) {
  const left = value(a, column),
    right = value(b, column);
  // Unknown values stay below known values in either direction; zero is a real value.
  if (left === null && right !== null) return 1;
  if (right === null && left !== null) return -1;
  const order =
    typeof left === 'number' && typeof right === 'number'
      ? left - right
      : String(left ?? '').localeCompare(String(right ?? ''), undefined, {
          numeric: true,
          sensitivity: 'base',
        });
  return (
    order * (direction === 'asc' ? 1 : -1) ||
    (numeric(b.rating) ?? -Infinity) - (numeric(a.rating) ?? -Infinity) ||
    `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`) ||
    a.id.localeCompare(b.id)
  );
}
