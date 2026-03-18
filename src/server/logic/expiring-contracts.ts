import type { ExpiringContractRow } from '@/lib/expiring-contracts';
import type { IngestedLeagueData } from '@/server/data/nfl-data';

const toCurrency = (value: number | null | undefined): number => {
  if (value === null || value === undefined) {
    return 0;
  }
  return Math.max(0, Math.round(value));
};

const estimateValue = (averagePerYear: number | null, capHit: number | null): number => {
  const preferred = averagePerYear ?? capHit;
  if (preferred !== null) {
    return toCurrency(preferred);
  }
  return 1_200_000;
};

const isFreeAgentStatus = (status: string | null | undefined): boolean => {
  if (!status) {
    return false;
  }
  const normalized = status.toUpperCase();
  return normalized.includes('UFA') || normalized.includes('RFA') || normalized.includes('ERFA');
};

const isExpiring = (
  years: number | null,
  contractEndYear: number | null,
  seasonYear: number,
  contractStatus?: string | null,
) => {
  if (typeof years === 'number' && Number.isFinite(years)) {
    return years <= 1;
  }
  if (typeof contractEndYear === 'number' && Number.isFinite(contractEndYear)) {
    return contractEndYear <= seasonYear;
  }
  return isFreeAgentStatus(contractStatus);
};

export const getExpiringContractsForTeam = (
  teamAbbr: string,
  leagueData: IngestedLeagueData,
): ExpiringContractRow[] => {
  const normalizedTeamAbbr = teamAbbr.toUpperCase();
  const seasonYear = new Date().getUTCFullYear();
  const playersById = new Map(leagueData.players.map((player) => [player.id, player]));

  const rows = leagueData.contracts
    .filter((contract) => contract.teamAbbr === normalizedTeamAbbr)
    .filter((contract) =>
      isExpiring(contract.years, contract.contractEndYear, seasonYear, contract.contractStatus),
    )
    .map((contract) => {
      const matchingPlayer = playersById.get(contract.playerId);
      if (!matchingPlayer) {
        return null;
      }
      const estValue = estimateValue(contract.averagePerYear, contract.capHit);
      return {
        id: matchingPlayer.id,
        name: matchingPlayer.name,
        pos: matchingPlayer.position,
        teamAbbr: normalizedTeamAbbr,
        lastTeamAbbr: normalizedTeamAbbr,
        contractType: contract.contractStatus ?? 'UFA',
        interestPct: 0,
        age: matchingPlayer.age ?? 27,
        rating: matchingPlayer.rating,
        estValue,
        currentSalary: toCurrency(contract.capHit),
        maxValue: Math.round(estValue * 1.2),
        headshotUrl: matchingPlayer.headshotUrl,
        previousTeamAbbr: normalizedTeamAbbr,
      } satisfies ExpiringContractRow;
    })
    .filter((row): row is ExpiringContractRow => row !== null)
    .sort((a, b) => b.estValue - a.estValue);

  console.info(`[expiring] team=${normalizedTeamAbbr} count=${rows.length}`);
  return rows;
};
