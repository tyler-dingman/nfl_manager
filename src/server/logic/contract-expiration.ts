import type { UnifiedContract, UnifiedPlayer } from '@/server/data/nfl-data';

/**
 * Single source of truth for the OTC league year currently modeled by this dataset.
 *
 * Example: when the app is in the 2026 offseason, OTC contract/cap tables are for 2026.
 */
export const CURRENT_MODELED_LEAGUE_YEAR = 2026;

/**
 * Single source of truth for the current playable NFL season that just finished
 * and whose expirations should appear in the offseason UI.
 *
 * Example: in the 2026 offseason, contracts that expired after the 2025 season
 * belong in Expiring Contracts.
 */
export const CURRENT_PLAYABLE_SEASON_YEAR = CURRENT_MODELED_LEAGUE_YEAR - 1;

/**
 * Season used for "ending after this season" checks in offseason/free-agency flows.
 */
export const OFFSEASON_EXPIRING_SEASON_YEAR = CURRENT_PLAYABLE_SEASON_YEAR;

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

type UnknownRecord = Record<string, unknown>;

const YEAR_FIELD_KEYS = [
  'year',
  'years',
  'contractYear',
  'contractYears',
  'contractSeasons',
  'contractThrough',
  'endYear',
  'contractEndYear',
  'seasons',
] as const;

const YEARLY_ROW_KEYS = [
  'capHits',
  'capRows',
  'yearlyBreakdown',
  'contractRows',
  'contractYears',
  'contractSeasons',
  'seasons',
] as const;

const normalizeYear = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value >= 2000 && value <= 2200) {
      return value;
    }
    if (value >= 0 && value <= 99) {
      return 2000 + value;
    }
    return null;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const fourDigit = trimmed.match(/\b(20\d{2})\b/)?.[1];
  if (fourDigit) {
    return Number.parseInt(fourDigit, 10);
  }

  const twoDigit = trimmed.match(/(?:^|[^0-9])['’](\d{2})(?:[^0-9]|$)/)?.[1];
  if (twoDigit) {
    return 2000 + Number.parseInt(twoDigit, 10);
  }

  const numeric = Number.parseInt(trimmed.replace(/[^0-9-]/g, ''), 10);
  if (Number.isFinite(numeric) && numeric >= 2000 && numeric <= 2200) {
    return numeric;
  }

  return null;
};

const getMaxYearFromArray = (rows: unknown[]): number | null => {
  const years = rows
    .flatMap((row) => {
      if (!row || typeof row !== 'object') {
        return [];
      }
      const record = row as UnknownRecord;
      const direct = ['year', 'season', 'contractYear', 'contractSeason', 'yr']
        .map((key) => normalizeYear(record[key]))
        .filter((year): year is number => year !== null);

      if (direct.length > 0) {
        return direct;
      }

      return Object.entries(record)
        .flatMap(([key, value]) => {
          const keyYear = normalizeYear(key);
          const valueYear = normalizeYear(value);
          return [keyYear, valueYear].filter((year): year is number => year !== null);
        })
        .filter((year) => year >= 2000);
    })
    .filter((year) => Number.isFinite(year));

  if (years.length === 0) {
    return null;
  }
  return Math.max(...years);
};

export const getContractFinalYear = (contract: UnifiedContract): number | null => {
  if (typeof contract.contractEndYear === 'number' && Number.isFinite(contract.contractEndYear)) {
    return contract.contractEndYear;
  }

  const unknownContract = contract as UnknownRecord;

  const yearlyRowCandidates = YEARLY_ROW_KEYS.flatMap((key) => {
    const value = unknownContract[key];
    if (Array.isArray(value)) {
      return value.length > 0 ? [value] : [];
    }
    if (value && typeof value === 'object') {
      const values = Object.values(value as UnknownRecord);
      return values.length > 0 ? [values] : [];
    }
    return [];
  });

  const rowBasedYears = yearlyRowCandidates
    .map((rows) => getMaxYearFromArray(rows))
    .filter((year): year is number => year !== null);

  if (rowBasedYears.length > 0) {
    return Math.max(...rowBasedYears);
  }

  const topLevelYears = YEAR_FIELD_KEYS.map((field) =>
    normalizeYear(unknownContract[field]),
  ).filter((year): year is number => year !== null);

  if (topLevelYears.length > 0) {
    return Math.max(...topLevelYears);
  }

  return null;
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

  const contractsWithFinalYear = matchedContracts.map((contract) => ({
    contract,
    finalYear: getContractFinalYear(contract),
  }));

  const endingThisSeason = contractsWithFinalYear
    .filter(({ finalYear }) => isExpiringAfterSeason(finalYear, seasonYear))
    .map(({ contract }) => contract);

  const sample: ExpiringContractDebugSample[] = endingThisSeason.slice(0, 8).map((contract) => {
    const player = rosteredById.get(contract.playerId);
    return {
      playerName: player?.name ?? contract.playerId,
      teamAbbr: contract.teamAbbr,
      contractFinalYear: contract.contractEndYear ?? null,
      contractId: `${contract.teamAbbr}:${contract.playerId}`,
    };
  });

  const contractsWithDerivedFinalYear = contractsWithFinalYear.filter(
    ({ finalYear }) => finalYear !== null,
  ).length;
  const finalYearDistribution = contractsWithFinalYear.reduce<Record<string, number>>(
    (acc, { finalYear }) => {
      if (finalYear === null) {
        acc.unknown = (acc.unknown ?? 0) + 1;
        return acc;
      }
      const key = String(finalYear);
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    },
    {},
  );

  const debugSamples = matchedContracts.slice(0, 8).map((contract) => {
    const player = rosteredById.get(contract.playerId);
    const unknownContract = contract as UnknownRecord;
    const candidateYearFields = Object.fromEntries(
      YEAR_FIELD_KEYS.map((field) => [field, unknownContract[field] ?? null]),
    );
    const yearlyRows = Object.fromEntries(
      YEARLY_ROW_KEYS.map((field) => {
        const value = unknownContract[field];
        if (Array.isArray(value)) {
          return [field, value.slice(0, 3)];
        }
        if (value && typeof value === 'object') {
          return [field, Object.entries(value as UnknownRecord).slice(0, 3)];
        }
        return [field, null];
      }),
    );
    return {
      playerName: player?.name ?? contract.playerId,
      teamAbbr: contract.teamAbbr,
      candidateYearFields,
      yearlyRows,
      computedFinalYear: getContractFinalYear(contract),
    };
  });

  return {
    rosteredPlayers,
    matchedContracts,
    endingThisSeason,
    sample,
    contractsWithDerivedFinalYear,
    finalYearDistribution,
    finalYearForSeasonCount: finalYearDistribution[String(seasonYear)] ?? 0,
    debugSamples,
    seasonYear,
  };
};
