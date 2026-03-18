import type { ExpiringContractRow } from '@/lib/expiring-contracts';
import type { IngestedLeagueData } from '@/server/data/nfl-data';
import {
  buildRosterMatchedExpiringContracts,
  OFFSEASON_EXPIRING_SEASON_YEAR,
} from '@/server/logic/contract-expiration';

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

export const getExpiringContractsForTeam = (
  teamAbbr: string,
  leagueData: IngestedLeagueData,
): ExpiringContractRow[] => {
  const normalizedTeamAbbr = teamAbbr.toUpperCase();
  const seasonYear = OFFSEASON_EXPIRING_SEASON_YEAR;
  const playersById = new Map(leagueData.players.map((player) => [player.id, player]));

  const expiring = buildRosterMatchedExpiringContracts({
    players: leagueData.players,
    contracts: leagueData.contracts,
    teamAbbr: normalizedTeamAbbr,
    seasonYear,
  });

  const rows = expiring.endingThisSeason
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

  console.info(`[expiring] rostered players=${expiring.rosteredPlayers.length}`);
  console.info(`[expiring] matched contracts=${expiring.matchedContracts.length}`);
  console.info(`[expiring] ending after ${seasonYear} season=${expiring.endingThisSeason.length}`);
  console.info(`[expiring] expiring contracts count=${rows.length}`);
  console.info(`[expiring] sample=${JSON.stringify(expiring.sample)}`);
  console.info(`[expiring] team=${normalizedTeamAbbr} count=${rows.length}`);
  return rows;
};
