import { normalizePlayerName } from '@/server/ingest/normalize';
import type { IngestedLeagueData, UnifiedPlayer } from '@/server/data/nfl-data';
import type { ExpiringContractRow } from '@/lib/expiring-contracts';
import type { PlayerRowDTO } from '@/types/player';
import { buildFreeAgentProfile, bucketPosition } from '@/server/logic/free-agency-pool';
import { getFreeAgentExpectedApyDollars } from '@/lib/free-agent-valuation';
import type { OtcFreeAgencyRow } from '@/server/data-sources/overthecap-free-agency';
import {
  buildRosterMatchedExpiringContracts,
  OFFSEASON_EXPIRING_SEASON_YEAR,
} from '@/server/logic/contract-expiration';

const splitName = (name: string) => {
  const parts = name.trim().split(/\s+/);
  return { firstName: parts[0] ?? name, lastName: parts.slice(1).join(' ') };
};

const moneyFromRating = (rating?: number) => {
  if (!rating) return 1_800_000;
  return Math.round((0.8 + rating / 20) * 1_000_000);
};

const estimateContractValue = ({
  averagePerYear,
  capHit,
  rating,
}: {
  averagePerYear: number | null | undefined;
  capHit: number | null | undefined;
  rating?: number;
}): number => {
  const value = averagePerYear ?? capHit;
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.round(value);
  }
  return moneyFromRating(rating);
};

const compareByRatingThenName = (a: ExpiringContractRow, b: ExpiringContractRow) => {
  const aRating = a.rating ?? null;
  const bRating = b.rating ?? null;

  if (aRating === null && bRating !== null) return 1;
  if (aRating !== null && bRating === null) return -1;
  if (aRating !== null && bRating !== null && bRating !== aRating) {
    return bRating - aRating;
  }

  return a.name.localeCompare(b.name);
};

export const resolveOffseasonPlayerIdentity = (
  row: OtcFreeAgencyRow,
  league: IngestedLeagueData,
): UnifiedPlayer | null => {
  const matches = league.players.filter(
    (player) => normalizePlayerName(player.name) === row.normalizedName,
  );
  if (matches.length === 0) return null;
  const byTeam = row.priorTeamAbbr
    ? matches.find((player) => player.teamAbbr === row.priorTeamAbbr)
    : undefined;
  if (byTeam) return byTeam;
  const byPosition = row.position
    ? matches.find(
        (player) => bucketPosition(player.position) === bucketPosition(row.position ?? ''),
      )
    : undefined;
  return byPosition ?? (matches.length === 1 ? matches[0] : (matches[0] ?? null));
};

export const buildTeamExpiringContracts = ({
  teamAbbr,
  otcRows,
  league,
  resolvedIds,
}: {
  teamAbbr: string;
  otcRows: OtcFreeAgencyRow[];
  league: IngestedLeagueData;
  resolvedIds?: Set<string>;
}): ExpiringContractRow[] => {
  const normalizedTeam = teamAbbr.toUpperCase();
  const seasonYear = OFFSEASON_EXPIRING_SEASON_YEAR;
  const playersById = new Map(league.players.map((player) => [player.id, player]));

  const expiring = buildRosterMatchedExpiringContracts({
    players: league.players,
    contracts: league.contracts,
    teamAbbr: normalizedTeam,
    seasonYear,
  });

  const contracts = expiring.endingThisSeason
    .map((contract) => {
      const matched = playersById.get(contract.playerId);
      if (!matched) {
        return null;
      }
      const estValue = estimateContractValue({
        averagePerYear: contract.averagePerYear,
        capHit: contract.capHit,
        rating: matched.rating,
      });
      return {
        id: matched.id,
        name: matched.name,
        pos: matched.position,
        teamAbbr: normalizedTeam,
        contractType: contract.contractStatus ?? 'UFA',
        interestPct: 0,
        age: matched.age ?? 27,
        rating: matched.rating,
        estValue,
        currentSalary: estimateContractValue({
          averagePerYear: contract.capHit,
          capHit: contract.capHit,
          rating: matched.rating,
        }),
        maxValue: Math.round(estValue * 1.2),
        headshotUrl: matched.headshotUrl ?? null,
        lastTeamAbbr: normalizedTeam,
        previousTeamAbbr: normalizedTeam,
      } satisfies ExpiringContractRow;
    })
    .filter((row): row is ExpiringContractRow => row !== null)
    .filter((row) => !(resolvedIds?.has(row.id) ?? false));

  return contracts.sort(compareByRatingThenName);
};

export const buildInitialFreeAgencyPool = ({
  saveId,
  teamAbbr,
  otcRows,
  league,
  walkaways = [],
}: {
  saveId: string;
  teamAbbr: string;
  otcRows: OtcFreeAgencyRow[];
  league: IngestedLeagueData;
  walkaways?: PlayerRowDTO[];
}): PlayerRowDTO[] => {
  const generatedAt = new Date().toISOString();
  const map = new Map<string, PlayerRowDTO>();
  const persistedFreeAgentsById = new Map(league.freeAgents.map((entry) => [entry.id, entry]));
  const persistedFreeAgentsByNameAndPosition = new Map(
    league.freeAgents.map((entry) => [
      `${entry.normalizedName}:${bucketPosition(entry.position ?? 'UNK')}`,
      entry,
    ]),
  );

  otcRows
    .filter((row) => row.nextTeamAbbr === null)
    .forEach((row) => {
      const matched = resolveOffseasonPlayerIdentity(row, league);
      const resolvedName = matched?.name ?? row.playerName;
      const normalized = normalizePlayerName(resolvedName);
      const key = `${normalized}:${bucketPosition(row.position ?? matched?.position ?? 'UNK')}`;
      const persistedFreeAgent =
        (matched?.id ? persistedFreeAgentsById.get(matched.id) : null) ??
        persistedFreeAgentsById.get(
          `fa-otc-${normalized}-${row.position ?? matched?.position ?? 'UNK'}`.toLowerCase(),
        ) ??
        persistedFreeAgentsByNameAndPosition.get(key) ??
        null;
      const split = splitName(resolvedName);
      const marketValue =
        getFreeAgentExpectedApyDollars({
          position: row.position ?? matched?.position ?? 'UNK',
          rating: matched?.rating ?? persistedFreeAgent?.rating ?? undefined,
          marketValue: moneyFromRating(matched?.rating ?? persistedFreeAgent?.rating ?? undefined),
        }) ?? moneyFromRating(matched?.rating ?? persistedFreeAgent?.rating ?? undefined);
      map.set(key, {
        id:
          matched?.id ??
          `otc-fa-${normalized}-${row.priorTeamAbbr ?? 'UNK'}-${row.position ?? 'UNK'}`,
        firstName: split.firstName,
        lastName: split.lastName,
        normalizedName: normalized,
        position: row.position ?? matched?.position ?? 'UNK',
        age: row.age ?? matched?.age ?? undefined,
        height: matched?.height ?? persistedFreeAgent?.height ?? null,
        weight: matched?.weight ?? persistedFreeAgent?.weight ?? null,
        baselineRating: matched?.baselineRating ?? persistedFreeAgent?.baselineRating ?? null,
        maddenRating: matched?.maddenRating ?? persistedFreeAgent?.maddenRating ?? null,
        rating: matched?.rating ?? persistedFreeAgent?.rating ?? undefined,
        stats: matched ? { ...matched.stats } : (persistedFreeAgent?.stats ?? {}),
        marketValue,
        contractYearsRemaining: 0,
        capHit: '$0.0M',
        capHitValue: 0,
        salary: 0,
        guaranteed: 0,
        status: 'Free Agent',
        headshotUrl: matched?.headshotUrl ?? persistedFreeAgent?.headshotUrl ?? null,
        lastTeamAbbr: row.priorTeamAbbr ?? persistedFreeAgent?.lastTeamAbbr ?? null,
        currentTeamAbbr: null,
        contractStatus: row.freeAgentType ?? persistedFreeAgent?.contractStatus ?? null,
        isUnsigned: true,
        averagePerYear: persistedFreeAgent?.averagePerYear ?? null,
        signedTeamAbbr: row.priorTeamAbbr ?? null,
        freeAgentProfile: buildFreeAgentProfile({
          playerId: matched?.id ?? `otc-${normalized}`,
          saveId,
          position: row.position ?? matched?.position ?? 'UNK',
          age: row.age ?? matched?.age ?? undefined,
          lastContractApy: marketValue,
          lastGuaranteed: Math.round(marketValue * 0.45),
          teamAbbr,
          generatedAt,
          source: 'real',
        }),
      });
    });

  walkaways.forEach((player) => {
    const key = `${normalizePlayerName(`${player.firstName} ${player.lastName}`)}:${bucketPosition(player.position)}`;
    map.set(key, player);
  });
  return Array.from(map.values());
};
