import type { ExpiringContractRow } from '@/lib/expiring-contracts';
import type { FranchiseSimulationState } from '@/types/front-office';
import type { PlayerRowDTO } from '@/types/player';

export const RE_SIGN_READY_CONFIG = {
  baseChance: 0.08,
  midseasonMultiplier: 2.25,
  lateSeasonMultiplier: 4.25,
  closingWeeksMultiplier: 7.5,
  maxActiveEvents: 3,
  cooldownWeeks: 2,
  priorityPoolSize: 3,
} as const;

export type ReSignReadyCandidate = {
  playerId: string;
  contractId: string;
  name: string;
  position: string;
  rating: number;
  age: number;
  contractValue: number;
  headshotUrl: string | null;
  priorityScore: number;
};

const hashUnit = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4_294_967_295;
};

const positionalValue: Record<string, number> = {
  QB: 22,
  EDGE: 16,
  DE: 15,
  OT: 15,
  LT: 16,
  RT: 14,
  WR: 14,
  CB: 14,
  DT: 11,
  TE: 9,
  S: 9,
  LB: 8,
  RB: 6,
};

export function rankReSignReadyCandidates(input: {
  teamAbbr: string;
  season: number;
  roster: PlayerRowDTO[];
  expiringContracts: ExpiringContractRow[];
  simulation: FranchiseSimulationState;
}) {
  const rosterById = new Map(input.roster.map((player) => [player.id, player]));
  return input.expiringContracts
    .flatMap((contract): ReSignReadyCandidate[] => {
      const player = rosterById.get(contract.id);
      if (!player) return [];
      if (['cut', 'released', 'traded'].includes(player.status?.toLowerCase())) return [];
      if ((player.contractYearsRemaining ?? player.contract?.yearsRemaining ?? 1) > 1) return [];
      const state = input.simulation.contractNegotiations?.[player.id]?.state;
      if (state && state !== 'not_open') return [];
      const rating =
        contract.rating ?? player.rating ?? player.maddenRating ?? player.baselineRating ?? 65;
      const age = contract.age ?? player.age ?? 27;
      const position = contract.pos.toUpperCase();
      const contractValue = contract.estValue || player.averagePerYear || player.capHitValue || 0;
      const priorityScore =
        rating * 2.4 +
        (rating >= 85 ? 22 : rating >= 78 ? 10 : 0) +
        (positionalValue[position] ?? 5) +
        Math.min(12, contractValue / 2_000_000) -
        Math.max(0, age - 29) * 1.5;
      return [
        {
          playerId: player.id,
          contractId: `${input.teamAbbr}:${player.id}:${input.season}`,
          name: contract.name || `${player.firstName} ${player.lastName}`,
          position,
          rating,
          age,
          contractValue,
          headshotUrl: contract.headshotUrl ?? player.headshotUrl ?? null,
          priorityScore,
        },
      ];
    })
    .sort(
      (left, right) =>
        right.priorityScore - left.priorityScore || left.playerId.localeCompare(right.playerId),
    )
    .slice(0, RE_SIGN_READY_CONFIG.priorityPoolSize);
}

export function selectReSignReadyCandidate(input: {
  seed: string;
  week: number;
  candidates: ReSignReadyCandidate[];
  simulation: FranchiseSimulationState;
}) {
  if (!input.candidates.length) return null;
  const active = Object.values(input.simulation.contractNegotiations ?? {}).filter((entry) =>
    ['ready', 'negotiating'].includes(entry.state),
  );
  if (active.length >= RE_SIGN_READY_CONFIG.maxActiveEvents) return null;
  const lastReadyWeek = Math.max(0, ...active.map((entry) => entry.readyWeek ?? 0));
  if (lastReadyWeek && input.week - lastReadyWeek <= RE_SIGN_READY_CONFIG.cooldownWeeks)
    return null;
  const multiplier =
    input.week >= 15
      ? RE_SIGN_READY_CONFIG.closingWeeksMultiplier
      : input.week >= 11
        ? RE_SIGN_READY_CONFIG.lateSeasonMultiplier
        : input.week >= 5
          ? RE_SIGN_READY_CONFIG.midseasonMultiplier
          : 1;
  const chance = Math.min(0.9, RE_SIGN_READY_CONFIG.baseChance * multiplier);
  if (hashUnit(`${input.seed}:re-sign-ready:week:${input.week}`) >= chance) return null;
  const index = Math.min(
    input.candidates.length - 1,
    Math.floor(
      hashUnit(`${input.seed}:re-sign-ready-player:${input.week}`) * input.candidates.length,
    ),
  );
  return input.candidates[index] ?? null;
}
