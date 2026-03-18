import type { UnifiedContract, UnifiedPlayer } from '@/server/data/nfl-data';

export const OFFSEASON_EXPIRING_SEASON_YEAR = 2025;

export const isExpiringAfterSeason = (
  contractFinalYear: number | null | undefined,
  seasonYear: number,
): boolean => {
  if (typeof contractFinalYear !== 'number' || !Number.isFinite(contractFinalYear)) {
    return false;
  }
  return contractFinalYear === seasonYear;
};

export type ExpiringContractDebugSample = {
  playerName: string;
  teamAbbr: string;
  contractFinalYear: number | null;
  contractId: string;
};

export const buildRosterMatchedExpiringContracts = ({
  players,
  contracts,
  teamAbbr,
  seasonYear = OFFSEASON_EXPIRING_SEASON_YEAR,
}: {
  players: UnifiedPlayer[];
  contracts: UnifiedContract[];
  teamAbbr?: string;
  seasonYear?: number;
}) => {
  const normalizedTeam = teamAbbr?.toUpperCase() ?? null;
  const rosteredPlayers = normalizedTeam
    ? players.filter((player) => player.teamAbbr === normalizedTeam)
    : players;

  const rosteredById = new Map(rosteredPlayers.map((player) => [player.id, player]));

  const matchedContracts = contracts.filter((contract) => {
    if (normalizedTeam && contract.teamAbbr !== normalizedTeam) {
      return false;
    }
    const player = rosteredById.get(contract.playerId);
    return Boolean(player && player.teamAbbr === contract.teamAbbr);
  });

  const endingThisSeason = matchedContracts.filter((contract) =>
    isExpiringAfterSeason(contract.contractEndYear, seasonYear),
  );

  const sample: ExpiringContractDebugSample[] = endingThisSeason.slice(0, 8).map((contract) => {
    const player = rosteredById.get(contract.playerId);
    return {
      playerName: player?.name ?? contract.playerId,
      teamAbbr: contract.teamAbbr,
      contractFinalYear: contract.contractEndYear ?? null,
      contractId: `${contract.teamAbbr}:${contract.playerId}`,
    };
  });

  return {
    rosteredPlayers,
    matchedContracts,
    endingThisSeason,
    sample,
    seasonYear,
  };
};
