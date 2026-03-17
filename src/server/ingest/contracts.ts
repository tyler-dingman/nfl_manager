import type { IngestedContract, IngestedPlayer, IngestedTeam } from '@/server/data/nfl-data';
import { fetchAllTeamContracts, fetchTeamContracts } from '@/server/data-sources/overthecap-contracts';
import { normalizePlayerName } from './normalize';

export type ContractSyncReport = {
  totalContractRows: number;
  matchedPlayers: number;
  unmatchedPlayers: number;
  duplicateMatchConflicts: number;
  teamsWithMissingContractPages: string[];
};

export type ContractSyncResult = {
  contracts: IngestedContract[];
  report: ContractSyncReport;
};

const safeUniquePlayerMatch = (candidates: IngestedPlayer[], normalizedName: string): IngestedPlayer | null => {
  const byName = candidates.filter((player) => player.normalizedName === normalizedName);
  return byName.length === 1 ? byName[0] : null;
};

const upsertContract = (existing: IngestedContract | undefined, next: IngestedContract): IngestedContract => {
  if (!existing) return next;
  return {
    ...existing,
    ...next,
  };
};

const buildContractRecord = (
  player: IngestedPlayer,
  row: Awaited<ReturnType<typeof fetchTeamContracts>>['rows'][number],
  contractLastSyncedAt: string,
): IngestedContract => {
  const guaranteedRemaining =
    row.guaranteedMoney ?? row.fullyGuaranteedMoney ?? row.signingBonus ?? row.rosterBonus ?? null;

  return {
    playerId: player.id,
    teamId: player.teamAbbr,
    source: 'overthecap',
    externalSourceKey: row.externalSourceKey,
    contractStatus: row.contractStatus,
    yearsRemaining: row.yearsRemaining,
    contractValue: row.contractValue,
    averagePerYear: row.averagePerYear,
    guaranteedMoney: row.guaranteedMoney,
    fullyGuaranteedMoney: row.fullyGuaranteedMoney,
    signingBonus: row.signingBonus,
    rosterBonus: row.rosterBonus,
    workoutBonus: row.workoutBonus,
    restructureMetadata: null,
    postJune1Savings: row.postJune1Savings,
    releaseSavings: row.releaseSavings,
    deadCap: row.deadCap,
    capHitCurrentYear: row.capHitCurrentYear,
    capHitFutureYears: row.capHitFutureYears,
    baseSalary: row.baseSalary,
    guaranteedRemaining,
    releaseSavingsEstimate: row.releaseSavings,
    deadCapEstimate: row.deadCap,
    contractLastSyncedAt,
    rawContractPayload: row.rawContractPayload,
  };
};

const syncContractsInternal = async (
  teams: IngestedTeam[],
  players: IngestedPlayer[],
  existingContracts: IngestedContract[],
  teamId?: string,
): Promise<ContractSyncResult> => {
  const now = new Date().toISOString();
  const existingByPlayer = new Map(existingContracts.map((contract) => [`${contract.teamId}:${contract.playerId}`, contract]));

  const playersByTeam = new Map<string, IngestedPlayer[]>();
  for (const player of players) {
    const bucket = playersByTeam.get(player.teamAbbr) ?? [];
    bucket.push(player);
    playersByTeam.set(player.teamAbbr, bucket);
  }

  const unresolvedTeams: string[] = [];
  const scrapeResults =
    teamId === undefined
      ? await fetchAllTeamContracts()
      : [
          await fetchTeamContracts(teamId).catch((error: unknown) => {
            const team = teams.find((entry) => entry.id === teamId || entry.abbreviation === teamId);
            unresolvedTeams.push(team?.abbreviation ?? teamId);
            return {
              teamSlug: team?.normalizedName ?? teamId.toLowerCase(),
              teamAbbr: team?.abbreviation ?? teamId.toUpperCase(),
              teamName: team?.name ?? teamId,
              rows: [],
              error: error instanceof Error ? error.message : 'Unknown error',
            };
          }),
        ];

  const report: ContractSyncReport = {
    totalContractRows: 0,
    matchedPlayers: 0,
    unmatchedPlayers: 0,
    duplicateMatchConflicts: 0,
    teamsWithMissingContractPages: [],
  };

  const nextByPlayer = new Map(existingByPlayer);

  for (const result of scrapeResults) {
    if (result.error) {
      report.teamsWithMissingContractPages.push(result.teamAbbr);
      continue;
    }

    const teamPlayers = playersByTeam.get(result.teamAbbr) ?? [];
    report.totalContractRows += result.rows.length;

    for (const row of result.rows) {
      const normalizedName = normalizePlayerName(row.playerName);
      const exact = teamPlayers.find((player) => player.normalizedName === normalizedName);
      const fallback = exact ?? safeUniquePlayerMatch(players, normalizedName);

      if (!fallback) {
        report.unmatchedPlayers += 1;
        console.warn(`[contracts] unmatched row ${row.playerName} (${result.teamAbbr})`);
        continue;
      }

      if (!exact && fallback.teamAbbr !== result.teamAbbr) {
        report.duplicateMatchConflicts += 1;
        console.warn(
          `[contracts] conflict row ${row.playerName} (${result.teamAbbr}) -> matched ${fallback.teamAbbr}:${fallback.id}`,
        );
        continue;
      }

      report.matchedPlayers += 1;
      const next = buildContractRecord(fallback, row, now);
      const key = `${next.teamId}:${next.playerId}`;
      nextByPlayer.set(key, upsertContract(existingByPlayer.get(key), next));
    }
  }

  for (const teamAbbr of unresolvedTeams) {
    if (!report.teamsWithMissingContractPages.includes(teamAbbr)) {
      report.teamsWithMissingContractPages.push(teamAbbr);
    }
  }

  return {
    contracts: Array.from(nextByPlayer.values()),
    report,
  };
};

export const syncContracts = async (
  teams: IngestedTeam[],
  players: IngestedPlayer[],
  existingContracts: IngestedContract[] = [],
): Promise<ContractSyncResult> => syncContractsInternal(teams, players, existingContracts);

export const syncContractsForTeam = async (
  teamId: string,
  teams: IngestedTeam[],
  players: IngestedPlayer[],
  existingContracts: IngestedContract[] = [],
): Promise<ContractSyncResult> => syncContractsInternal(teams, players, existingContracts, teamId);
