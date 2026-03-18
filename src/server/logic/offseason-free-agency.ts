import { normalizePlayerName } from '@/server/ingest/normalize';
import type { IngestedLeagueData, UnifiedPlayer } from '@/server/data/nfl-data';
import type { ExpiringContractRow } from '@/lib/expiring-contracts';
import type { PlayerRowDTO } from '@/types/player';
import { buildFreeAgentProfile, bucketPosition } from '@/server/logic/free-agency-pool';
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

  const rows = contracts.sort((a, b) => b.estValue - a.estValue);
  console.info(`[expiring] rostered players=${expiring.rosteredPlayers.length}`);
  console.info(`[expiring] matched contracts=${expiring.matchedContracts.length}`);
  console.info(`[expiring] ending after ${seasonYear} season=${expiring.endingThisSeason.length}`);
  console.info(`[expiring] expiring contracts count=${rows.length}`);
  console.info(`[expiring] sample=${JSON.stringify(expiring.sample)}`);
  console.info(`[expiring] team=${normalizedTeam} count=${rows.length}`);
  return rows;
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

  otcRows
    .filter((row) => row.nextTeamAbbr === null)
    .forEach((row) => {
      const matched = resolveOffseasonPlayerIdentity(row, league);
      const resolvedName = matched?.name ?? row.playerName;
      const normalized = normalizePlayerName(resolvedName);
      const key = `${normalized}:${bucketPosition(row.position ?? matched?.position ?? 'UNK')}`;
      const split = splitName(resolvedName);
      const marketValue = moneyFromRating(matched?.rating);
      map.set(key, {
        id:
          matched?.id ??
          `otc-fa-${normalized}-${row.priorTeamAbbr ?? 'UNK'}-${row.position ?? 'UNK'}`,
        firstName: split.firstName,
        lastName: split.lastName,
        position: row.position ?? matched?.position ?? 'UNK',
        age: row.age ?? matched?.age ?? undefined,
        rating: matched?.rating,
        marketValue,
        contractYearsRemaining: 0,
        capHit: '$0.0M',
        capHitValue: 0,
        salary: 0,
        guaranteed: 0,
        status: 'Free Agent',
        headshotUrl: matched?.headshotUrl ?? null,
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

  const pool = Array.from(map.values());
  console.info(`[offseason] freeAgencyPool=${pool.length}`);
  return pool;
};
