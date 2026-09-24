import type { PlayerRowDTO } from '@/types/player';

export const FRONT_OFFICE_ACTIVE_ROSTER_LIMIT = 53;
const group = (position: string) => {
  const p = position.toUpperCase();
  if (['LT', 'RT'].includes(p)) return 'OT';
  if (['LG', 'RG', 'G'].includes(p)) return 'OG';
  if (['DE', 'ED', 'OLB'].includes(p)) return 'EDGE';
  if (['NT', 'DL'].includes(p)) return 'DT';
  if (['MLB', 'ILB'].includes(p)) return 'LB';
  if (['FS', 'SS'].includes(p)) return 'S';
  if (p === 'FB') return 'RB';
  return p;
};
const depth: Record<string, number> = {
  QB: 2,
  RB: 3,
  WR: 5,
  TE: 3,
  OT: 4,
  OG: 3,
  C: 2,
  EDGE: 4,
  DT: 4,
  LB: 5,
  CB: 5,
  S: 4,
  K: 1,
  P: 1,
  LS: 1,
};
const available = (p: PlayerRowDTO) =>
  !/cut|released|free agent|practice|reserve|\bir\b|\bpup\b|suspended/i.test(p.status ?? '');

/** Seed/legacy saves contain the entire team pool. Assign a balanced simulation lineup,
 * preserving explicit assignments and all reserve players (no cuts or cap changes). */
export function assignSimulationRoster<T extends PlayerRowDTO>(
  players: T[],
  limit = FRONT_OFFICE_ACTIVE_ROSTER_LIMIT,
): T[] {
  const eligible = players
    .filter((p) => available(p) && !p.rosterAssignment)
    .sort(
      (a, b) =>
        (b.rating ?? b.maddenRating ?? b.baselineRating ?? 0) -
          (a.rating ?? a.maddenRating ?? a.baselineRating ?? 0) || a.id.localeCompare(b.id),
    );
  const selected = new Set(
    players.filter((p) => p.rosterAssignment === 'active' && available(p)).map((p) => p.id),
  );
  for (const [position, count] of Object.entries(depth)) {
    const already = players.filter(
      (p) => selected.has(p.id) && group(p.position) === position,
    ).length;
    for (const p of eligible
      .filter((p) => group(p.position) === position)
      .slice(0, Math.max(0, count - already))) {
      if (selected.size < limit) selected.add(p.id);
    }
  }
  for (const p of eligible) if (selected.size < limit) selected.add(p.id);
  return players.map((p) =>
    p.rosterAssignment ? p : { ...p, rosterAssignment: selected.has(p.id) ? 'active' : 'reserve' },
  );
}
export const getActiveSimulationRoster = (
  players: PlayerRowDTO[],
  teamAbbr?: string,
  limit = FRONT_OFFICE_ACTIVE_ROSTER_LIMIT,
) =>
  assignSimulationRoster(
    players.filter((p) => !teamAbbr || !p.teamAbbr || p.teamAbbr === teamAbbr),
    limit,
  ).filter((p) => p.rosterAssignment === 'active' && available(p));
