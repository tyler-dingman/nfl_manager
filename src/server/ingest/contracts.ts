import type {
  UnifiedContract,
  UnifiedFreeAgent,
  UnifiedPlayer,
  UnifiedTeam,
} from '@/server/data/nfl-data';
import {
  fetchAllTeamContracts,
  fetchTeamContracts,
  type TeamContractSourceRow,
} from '@/server/data-sources/overthecap-contracts';
import { fetchOtcFreeAgency } from '@/server/data-sources/overthecap-free-agency';
import { normalizePlayerName } from './normalize';
import { CURRENT_MODELED_LEAGUE_YEAR } from '@/server/logic/contract-expiration';

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

const safeUniquePlayerMatch = (
  candidates: UnifiedPlayer[],
  normalizedName: string,
): UnifiedPlayer | null => {
  const byName = candidates.filter((player) => normalizePlayerName(player.name) === normalizedName);
  return byName.length === 1 ? byName[0] : null;
};

const YEAR_SIGNAL_KEY_PATTERN =
  /(year|season|through|thru|term|expire|expiration|ufa|void|until|end)/i;
const FOUR_DIGIT_YEAR_PATTERN = /\b(20\d{2})\b/g;

const extractYearsFromText = (value: string): number[] =>
  Array.from(value.matchAll(FOUR_DIGIT_YEAR_PATTERN))
    .map((match) => Number.parseInt(match[1], 10))
    .filter((year) => Number.isFinite(year));

const getContractEndYear = ({
  yearsRemaining,
  futureCapHits,
  rawPayload,
}: {
  yearsRemaining: number | null;
  futureCapHits: Record<string, number> | null;
  rawPayload: Record<string, string | number | null>;
}): number | null => {
  const yearCandidates: number[] = [];

  // `yearsRemaining` is interpreted as inclusive of the current modeled league year.
  // Example: with modeled year 2026 and yearsRemaining=1, contractEndYear is 2026.
  if (typeof yearsRemaining === 'number' && Number.isFinite(yearsRemaining) && yearsRemaining > 0) {
    yearCandidates.push(CURRENT_MODELED_LEAGUE_YEAR + yearsRemaining - 1);
  }

  if (futureCapHits) {
    const futureYears = Object.keys(futureCapHits)
      .map((year) => Number.parseInt(year, 10))
      .filter((year) => Number.isFinite(year));
    yearCandidates.push(...futureYears);
  }

  for (const [key, value] of Object.entries(rawPayload)) {
    const keyLooksRelevant = YEAR_SIGNAL_KEY_PATTERN.test(key);
    const rawValue = value === null || value === undefined ? '' : String(value);
    const valueHasYear = FOUR_DIGIT_YEAR_PATTERN.test(rawValue);
    FOUR_DIGIT_YEAR_PATTERN.lastIndex = 0;

    if (!keyLooksRelevant && !valueHasYear) {
      continue;
    }

    yearCandidates.push(...extractYearsFromText(key));
    yearCandidates.push(...extractYearsFromText(rawValue));
  }

  if (yearCandidates.length === 0) {
    return null;
  }

  return Math.max(...yearCandidates);
};

const extractRawYearSignals = (
  row: TeamContractSourceRow,
): Record<string, string | number | null> =>
  Object.fromEntries(
    Object.entries(row.rawContractPayload).filter(([key, value]) => {
      const rawValue = value === null || value === undefined ? '' : String(value);
      return YEAR_SIGNAL_KEY_PATTERN.test(key) || extractYearsFromText(rawValue).length > 0;
    }),
  );

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
  const playerById = new Map(players.map((player) => [player.id, player]));
  const contractDebugSamples: Array<{
    playerName: string;
    rawSourceFields: Record<string, string | number | null>;
    yearSignalFields: Record<string, string | number | null>;
    normalizedContract: UnifiedContract;
  }> = [];

  for (const result of scrapeResults) {
    if (result.error) {
      report.teamsWithMissingContractPages.push(result.teamAbbr);
      continue;
    }

    const teamPlayers = playersByTeam.get(result.teamAbbr) ?? [];
    report.totalContractRows += result.rows.length;

    for (const row of result.rows) {
      const normalizedName = normalizePlayerName(row.playerName);
      const exact = teamPlayers.find(
        (player) => normalizePlayerName(player.name) === normalizedName,
      );
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
      const normalizedContract = {
        playerId: fallback.id,
        teamAbbr: result.teamAbbr,
        contractStatus: row.contractStatus,
        capHit: row.capHitCurrentYear,
        averagePerYear: row.averagePerYear,
        guaranteed: row.guaranteedMoney ?? row.fullyGuaranteedMoney ?? row.signingBonus ?? null,
        years: row.yearsRemaining,
        contractEndYear: getContractEndYear({
          yearsRemaining: row.yearsRemaining,
          futureCapHits: row.capHitFutureYears,
          rawPayload: row.rawContractPayload,
        }),
        deadCap: row.deadCap,
        releaseSavings: row.releaseSavings,
        postJune1Savings: row.postJune1Savings,
      } satisfies UnifiedContract;

      nextByPlayer.set(`${result.teamAbbr}:${fallback.id}`, normalizedContract);

      if (contractDebugSamples.length < 5) {
        contractDebugSamples.push({
          playerName: row.playerName,
          rawSourceFields: row.rawContractPayload,
          yearSignalFields: extractRawYearSignals(row),
          normalizedContract,
        });
      }

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

  try {
    const otcRows = await fetchOtcFreeAgency();
    otcRows
      .filter((row) => row.nextTeamAbbr === null)
      .forEach((row) => {
        const matches = playersByNormalizedName.get(row.normalizedName) ?? [];
        const matched =
          matches.find((player) => row.priorTeamAbbr && player.teamAbbr === row.priorTeamAbbr) ??
          (matches.length === 1 ? matches[0] : null);
        const id = matched?.id ?? `fa-otc-${slugify(`${row.playerName}-${row.position ?? 'UNK'}`)}`;
        const existing = freeAgentsById.get(id);
        const lastTeamAbbr =
          row.priorTeamAbbr ?? existing?.lastTeamAbbr ?? matched?.teamAbbr ?? 'UNK';
        const mergedPosition = matched?.position ?? row.position ?? existing?.position ?? 'UNK';
        const merged = {
          id,
          name: matched?.name ?? row.playerName,
          normalizedName: row.normalizedName,
          position: mergedPosition,
          age: row.age ?? matched?.age ?? existing?.age ?? null,
          headshotUrl: matched?.headshotUrl ?? existing?.headshotUrl ?? null,
          lastTeamAbbr,
          contractStatus: row.freeAgentType ?? existing?.contractStatus ?? 'UFA',
          currentTeamAbbr: null,
          isUnsigned: true,
          capHit: existing?.capHit ?? null,
          averagePerYear: existing?.averagePerYear ?? null,
        } satisfies UnifiedFreeAgent;
        freeAgentsById.set(id, merged);
      });
  } catch (error: unknown) {
    console.warn('[otc:fa] unable to enrich free agents from OTC scraper', error);
  }

  for (const [id, freeAgent] of freeAgentsById.entries()) {
    if (!freeAgent.isUnsigned && freeAgent.currentTeamAbbr) {
      continue;
    }
    const matchedPlayer = playerById.get(id);
    if (
      matchedPlayer &&
      matchedPlayer.teamAbbr &&
      matchedPlayer.teamAbbr !== freeAgent.lastTeamAbbr
    ) {
      freeAgentsById.set(id, {
        ...freeAgent,
        currentTeamAbbr: matchedPlayer.teamAbbr,
        isUnsigned: false,
      });
    }
  }

  if (contractDebugSamples.length > 0) {
    console.info(
      `[contracts:debug] raw sample=${JSON.stringify(
        contractDebugSamples.map((sample) => ({
          playerName: sample.playerName,
          rawSourceFields: sample.rawSourceFields,
          yearSignalFields: sample.yearSignalFields,
        })),
      )}`,
    );
    console.info(
      `[contracts:debug] normalized sample=${JSON.stringify(
        contractDebugSamples.map((sample) => ({
          playerName: sample.playerName,
          normalizedContract: sample.normalizedContract,
        })),
      )}`,
    );
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
