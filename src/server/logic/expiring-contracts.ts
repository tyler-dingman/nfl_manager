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

export const getExpiringContractsForTeam = (
  teamAbbr: string,
  leagueData: IngestedLeagueData,
): ExpiringContractRow[] => {
  const normalizedTeamAbbr = teamAbbr.toUpperCase();
  const activeRosterNames = new Set(
    leagueData.players
      .filter((player) => player.teamAbbr === normalizedTeamAbbr)
      .map((player) => player.name.toLowerCase()),
  );

  return leagueData.freeAgents
    .filter((freeAgent) => freeAgent.lastTeamAbbr === normalizedTeamAbbr)
    .filter((freeAgent) => freeAgent.isUnsigned)
    .filter((freeAgent) => !activeRosterNames.has(freeAgent.name.toLowerCase()))
    .map((freeAgent) => {
      const estValue = estimateValue(freeAgent.averagePerYear, freeAgent.capHit);
      return {
        id: freeAgent.id,
        name: freeAgent.name,
        pos: freeAgent.position,
        teamAbbr: normalizedTeamAbbr,
        lastTeamAbbr: freeAgent.lastTeamAbbr,
        contractType: freeAgent.contractStatus ?? 'UFA',
        interestPct: 0,
        age: freeAgent.age ?? 0,
        estValue,
        currentSalary: toCurrency(freeAgent.capHit),
        maxValue: Math.round(estValue * 1.2),
        headshotUrl: freeAgent.headshotUrl,
      } satisfies ExpiringContractRow;
    })
    .sort((a, b) => b.estValue - a.estValue);
};
