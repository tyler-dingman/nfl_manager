import type {
  UnifiedContract,
  UnifiedFreeAgent,
  UnifiedPlayer,
  UnifiedTeam,
} from '@/server/data/nfl-data';
import {
  fetchAllTeamContracts,
  fetchTeamContracts,
} from '@/server/data-sources/overthecap-contracts';
import { normalizePlayerName } from './normalize';

export type ContractSyncReport = {
  totalContractRows: number;
  matchedPlayers: number;
  unmatchedPlayers: number;
  duplicateMatchConflicts: number;
  teamsWithMissingContractPages: string[];
};

export type ContractSyncResult = {
  contracts: UnifiedContract[];
  freeAgents: UnifiedFreeAgent[];
  report: ContractSyncReport;
};

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const isFreeAgentStatus = (status: string | null): boolean => {
  if (!status) {
    return false;
  }
  const normalized = status.toUpperCase();
  return normalized.includes('UFA') || normalized.includes('RFA') || normalized.includes('ERFA');
};

const safeUniquePlayerMatch = (candidates: UnifiedPlayer[], normalizedName: string): UnifiedPlayer | null => {
  const byName = candidates.filter((player) => normalizePlayerName(player.name) === normalizedName);
  return byName.length === 1 ? byName[0] : null;
};

const syncContractsInternal = async (
  teams: UnifiedTeam[],
  players: UnifiedPlayer[],
  existingContracts: UnifiedContract[],
  teamId?: string,
): Promise<ContractSyncResult> => {
  const existingByPlayer = new Map(
    existingContracts.map((contract) => [`${contract.teamAbbr}:${contract.playerId}`, contract]),
  );

  const playersByTeam = new Map<string, UnifiedPlayer[]>();
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
            const team = teams.find((entry) => entry.id === teamId || entry.abbr === teamId);
            unresolvedTeams.push(team?.abbr ?? teamId);
            return {
              teamSlug: team?.name.toLowerCase().replace(/\s+/g, '-') ?? teamId.toLowerCase(),
              teamAbbr: team?.abbr ?? teamId.toUpperCase(),
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
  const playersByNormalizedName = new Map<string, UnifiedPlayer[]>();
  for (const player of players) {
    const normalized = normalizePlayerName(player.name);
    const bucket = playersByNormalizedName.get(normalized) ?? [];
    bucket.push(player);
    playersByNormalizedName.set(normalized, bucket);
  }
  const freeAgentsById = new Map<string, UnifiedFreeAgent>();

  for (const result of scrapeResults) {
    if (result.error) {
      report.teamsWithMissingContractPages.push(result.teamAbbr);
      continue;
    }

    const teamPlayers = playersByTeam.get(result.teamAbbr) ?? [];
    report.totalContractRows += result.rows.length;

    for (const row of result.rows) {
      const normalizedName = normalizePlayerName(row.playerName);
      const exact = teamPlayers.find((player) => normalizePlayerName(player.name) === normalizedName);
      const fallback = exact ?? safeUniquePlayerMatch(players, normalizedName);

      if (!fallback) {
        report.unmatchedPlayers += 1;
        continue;
      }

      if (!exact && fallback.teamAbbr !== result.teamAbbr) {
        report.duplicateMatchConflicts += 1;
        continue;
      }

      report.matchedPlayers += 1;
      nextByPlayer.set(`${result.teamAbbr}:${fallback.id}`, {
        playerId: fallback.id,
        teamAbbr: result.teamAbbr,
        contractStatus: row.contractStatus,
        capHit: row.capHitCurrentYear,
        averagePerYear: row.averagePerYear,
        guaranteed: row.guaranteedMoney ?? row.fullyGuaranteedMoney ?? row.signingBonus ?? null,
        years: row.yearsRemaining,
        deadCap: row.deadCap,
        releaseSavings: row.releaseSavings,
        postJune1Savings: row.postJune1Savings,
      });

      if (!isFreeAgentStatus(row.contractStatus)) {
        continue;
      }

      const currentTeamAbbr = fallback.teamAbbr === result.teamAbbr ? null : fallback.teamAbbr;
      const id = `fa-${result.teamAbbr.toLowerCase()}-${slugify(`${row.playerName}-${fallback.position}`)}`;
      freeAgentsById.set(id, {
        id,
        name: row.playerName,
        normalizedName,
        position: fallback.position,
        age: fallback.age,
        headshotUrl: fallback.headshotUrl,
        lastTeamAbbr: result.teamAbbr,
        contractStatus: row.contractStatus,
        currentTeamAbbr,
        isUnsigned: currentTeamAbbr === null,
        capHit: row.capHitCurrentYear,
        averagePerYear: row.averagePerYear,
      });
    }

    for (const row of result.rows) {
      if (!isFreeAgentStatus(row.contractStatus)) {
        continue;
      }

      const normalizedName = normalizePlayerName(row.playerName);
      const matches = playersByNormalizedName.get(normalizedName) ?? [];
      if (matches.length > 1) {
        continue;
      }

      const matchedPlayer = matches[0] ?? null;
      const currentTeamAbbr = matchedPlayer?.teamAbbr ?? null;
      const isUnsigned = currentTeamAbbr === null;
      const id = `fa-${result.teamAbbr.toLowerCase()}-${slugify(`${row.playerName}-${matchedPlayer?.position ?? 'UNK'}`)}`;

      freeAgentsById.set(id, {
        id,
        name: row.playerName,
        normalizedName,
        position: matchedPlayer?.position ?? 'UNK',
        age: matchedPlayer?.age ?? null,
        headshotUrl: matchedPlayer?.headshotUrl ?? null,
        lastTeamAbbr: result.teamAbbr,
        contractStatus: row.contractStatus,
        currentTeamAbbr,
        isUnsigned,
        capHit: row.capHitCurrentYear,
        averagePerYear: row.averagePerYear,
      });
    }
  }

  for (const teamAbbr of unresolvedTeams) {
    if (!report.teamsWithMissingContractPages.includes(teamAbbr)) {
      report.teamsWithMissingContractPages.push(teamAbbr);
    }
  }

  return {
    contracts: Array.from(nextByPlayer.values()),
    freeAgents: Array.from(freeAgentsById.values()),
    report,
  };
};

export const syncContracts = async (
  teams: UnifiedTeam[],
  players: UnifiedPlayer[],
  existingContracts: UnifiedContract[] = [],
): Promise<ContractSyncResult> => syncContractsInternal(teams, players, existingContracts);

export const syncContractsForTeam = async (
  teamId: string,
  teams: UnifiedTeam[],
  players: UnifiedPlayer[],
  existingContracts: UnifiedContract[] = [],
): Promise<ContractSyncResult> => syncContractsInternal(teams, players, existingContracts, teamId);
