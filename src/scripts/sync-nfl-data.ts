import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type {
  IngestedLeagueData,
  UnifiedContract,
  UnifiedFreeAgent,
  UnifiedPlayer,
} from '@/server/data/nfl-data';
import { fetchBestAvailableEspnPlayerProfile } from '@/server/data-sources/espn';
import {
  buildMaddenPlayerKey,
  type MaddenRatingRecord,
} from '@/server/data-sources/madden-ratings';
import { syncCap } from '@/server/ingest/cap';
import { syncContracts } from '@/server/ingest/contracts';
import { syncPlayers } from '@/server/ingest/players';
import { blendPlayerRating, generateBaselinePlayerRating } from '@/server/ingest/ratings';
import {
  buildRosterMatchedExpiringContracts,
  OFFSEASON_EXPIRING_SEASON_YEAR,
} from '@/server/logic/contract-expiration';

const DATA_FILE = path.join(process.cwd(), 'src/server/data/nfl-data.json');
const DEBUG_FREE_AGENT_NAMES = new Set([
  'Tyreek Hill',
  'Stefon Diggs',
  'Taylor Decker',
  'Jawaan Taylor',
]);
const DEBUG_EXPIRING_NAMES = new Set([
  'Jawaan Taylor',
  'Michael Danna',
  'Jack Cochrane',
  'Drue Tranquill',
  'Rashee Rice',
]);

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const normalizePositionBucket = (position: string): string => {
  const normalized = position.trim().toUpperCase();

  if (['LT', 'RT', 'T', 'OT'].includes(normalized)) return 'OT';
  if (['LG', 'RG', 'G'].includes(normalized)) return 'G';
  if (['C'].includes(normalized)) return 'C';
  if (['HB', 'FB', 'RB'].includes(normalized)) return 'RB';
  if (['WR'].includes(normalized)) return 'WR';
  if (['TE'].includes(normalized)) return 'TE';
  if (['QB'].includes(normalized)) return 'QB';
  if (['LE', 'RE', 'DE', 'EDGE'].includes(normalized)) return 'DE';
  if (['DT', 'NT', 'DL'].includes(normalized)) return 'DT';
  if (['LOLB', 'ROLB', 'ILB', 'MLB', 'LB', 'OLB'].includes(normalized)) return 'LB';
  if (['SS', 'FS', 'S'].includes(normalized)) return 'S';
  if (['CB'].includes(normalized)) return 'CB';
  if (['K', 'P'].includes(normalized)) return normalized;

  return normalized;
};

const normalizeFreeAgentName = (value: string): string =>
  value
    .toLowerCase()
    .replace(/\b(jr|sr|ii|iii|iv|v)\b/g, '')
    .replace(/[^a-z0-9]+/g, '');

const extractEspnAthleteId = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const match = value.match(/\/(\d+)(?:[./]|$)/);
  return match?.[1] ?? null;
};

type FreeAgentLookupMatch = {
  player: UnifiedPlayer;
  strategy: 'id' | 'externalId' | 'normalizedName+position' | 'normalizedName';
};

type FreeAgentMaddenMatch = {
  maddenRating: number;
  strategy: 'normalizedName+position' | 'normalizedName';
};

const buildFreeAgentPlayerLookup = (players: UnifiedPlayer[]) => {
  const playersById = new Map(players.map((player) => [player.id, player]));
  const playersByExternalId = new Map<string, UnifiedPlayer[]>();
  const playersByNormalizedName = new Map<string, UnifiedPlayer[]>();
  const playersByNormalizedNameAndPosition = new Map<string, UnifiedPlayer[]>();

  for (const player of players) {
    const normalizedName = normalizeFreeAgentName(player.name);
    const bucket = normalizePositionBucket(player.position);
    const externalId = extractEspnAthleteId(player.headshotUrl);

    const nameBucket = playersByNormalizedName.get(normalizedName) ?? [];
    nameBucket.push(player);
    playersByNormalizedName.set(normalizedName, nameBucket);

    const namePositionKey = `${normalizedName}:${bucket}`;
    const positionBucketPlayers = playersByNormalizedNameAndPosition.get(namePositionKey) ?? [];
    positionBucketPlayers.push(player);
    playersByNormalizedNameAndPosition.set(namePositionKey, positionBucketPlayers);

    if (externalId) {
      const externalBucket = playersByExternalId.get(externalId) ?? [];
      externalBucket.push(player);
      playersByExternalId.set(externalId, externalBucket);
    }
  }

  return {
    findMatch: ({
      id,
      externalId,
      normalizedName,
      position,
    }: {
      id: string;
      externalId: string | null;
      normalizedName: string;
      position: string;
    }): FreeAgentLookupMatch | null => {
      const directMatch = playersById.get(id);
      if (directMatch) {
        return { player: directMatch, strategy: 'id' };
      }

      if (externalId) {
        const externalMatches = playersByExternalId.get(externalId) ?? [];
        if (externalMatches.length === 1) {
          return { player: externalMatches[0], strategy: 'externalId' };
        }
      }

      const positionBucket = normalizePositionBucket(position);
      const nameAndPositionMatches =
        playersByNormalizedNameAndPosition.get(`${normalizedName}:${positionBucket}`) ?? [];
      if (nameAndPositionMatches.length === 1) {
        return {
          player: nameAndPositionMatches[0],
          strategy: 'normalizedName+position',
        };
      }

      const nameMatches = playersByNormalizedName.get(normalizedName) ?? [];
      if (nameMatches.length === 1) {
        return { player: nameMatches[0], strategy: 'normalizedName' };
      }

      return null;
    },
  };
};

const buildFreeAgentMaddenLookup = (rows: MaddenRatingRecord[]) => {
  const byNameTeamAndPosition = new Map<string, number>();
  const byNameOnly = new Map<string, number>();
  const byNameOnlyCounts = new Map<string, number>();

  rows.forEach((row) => {
    const keyParts = buildMaddenPlayerKey({
      playerName: row.playerName,
      team: row.team,
      position: row.position,
    });

    if (!keyParts.teamAbbr || !keyParts.normalizedName) {
      return;
    }

    const normalizedName = normalizeFreeAgentName(keyParts.normalizedName);
    const positionBucket = normalizePositionBucket(keyParts.position);
    const positionalKey = `${normalizedName}:${keyParts.teamAbbr}:${positionBucket}`;
    if (!byNameTeamAndPosition.has(positionalKey)) {
      byNameTeamAndPosition.set(positionalKey, row.overallRating);
    }

    byNameOnlyCounts.set(normalizedName, (byNameOnlyCounts.get(normalizedName) ?? 0) + 1);
    if (!byNameOnly.has(normalizedName)) {
      byNameOnly.set(normalizedName, row.overallRating);
    }
  });

  return {
    findMatch: ({
      normalizedName,
      teamAbbr,
      position,
    }: {
      normalizedName: string;
      teamAbbr: string | null | undefined;
      position: string;
    }): FreeAgentMaddenMatch | null => {
      if (teamAbbr) {
        const nameTeamPositionKey = `${normalizedName}:${teamAbbr}:${normalizePositionBucket(position)}`;
        const teamPositionMatch = byNameTeamAndPosition.get(nameTeamPositionKey);
        if (teamPositionMatch !== undefined) {
          return {
            maddenRating: teamPositionMatch,
            strategy: 'normalizedName+position',
          };
        }
      }

      const nameOnlyCount = byNameOnlyCounts.get(normalizedName) ?? 0;
      if (nameOnlyCount === 1) {
        const nameOnlyMatch = byNameOnly.get(normalizedName);
        if (nameOnlyMatch !== undefined) {
          return {
            maddenRating: nameOnlyMatch,
            strategy: 'normalizedName',
          };
        }
      }

      return null;
    },
  };
};

const logExpiringDebugSamples = ({
  players,
  contracts,
  freeAgents,
  expiringPlayerIds,
}: {
  players: UnifiedPlayer[];
  contracts: UnifiedContract[];
  freeAgents: UnifiedFreeAgent[];
  expiringPlayerIds: Set<string>;
}) => {
  const playersByName = new Map(players.map((player) => [player.name, player]));
  const contractsByPlayerId = new Map(contracts.map((contract) => [contract.playerId, contract]));
  const freeAgentsByName = new Map(freeAgents.map((player) => [player.name, player]));

  DEBUG_EXPIRING_NAMES.forEach((name) => {
    const player = playersByName.get(name) ?? null;
    const freeAgent = freeAgentsByName.get(name) ?? null;
    const contract = player ? (contractsByPlayerId.get(player.id) ?? null) : null;
    const contractFinalYear = contract?.contractEndYear ?? null;
    const yearsRemaining = contract?.years ?? null;
    const includedInExpiringContracts = player
      ? expiringPlayerIds.has(player.id)
      : freeAgent !== null && freeAgent.lastTeamAbbr === 'KC' && freeAgent.currentTeamAbbr === null;
    const reason = player
      ? contractFinalYear === OFFSEASON_EXPIRING_SEASON_YEAR
        ? 'contractFinalYear matches current playable season'
        : contractFinalYear === null
          ? 'no derived contractFinalYear'
          : `contractFinalYear ${contractFinalYear} does not match current playable season ${OFFSEASON_EXPIRING_SEASON_YEAR}`
      : freeAgent
        ? 'included from current offseason free-agent pool'
        : 'player not found in current rostered or free-agent pools';

    console.log(
      `[expiring] ${JSON.stringify({
        playerName: name,
        team: player?.teamAbbr ?? freeAgent?.lastTeamAbbr ?? null,
        yearsRemaining,
        contractFinalYear,
        currentSeasonYear: OFFSEASON_EXPIRING_SEASON_YEAR,
        includedInExpiringContracts,
        reason,
      })}`,
    );
  });
};

const buildRatedPlayers = (
  players: UnifiedPlayer[],
  contracts: UnifiedContract[],
): UnifiedPlayer[] => {
  const contractsByPlayerId = new Map(contracts.map((contract) => [contract.playerId, contract]));

  const playersByBucket = new Map<string, UnifiedPlayer[]>();
  for (const player of players) {
    const bucket = normalizePositionBucket(player.position);
    const list = playersByBucket.get(bucket) ?? [];
    list.push(player);
    playersByBucket.set(bucket, list);
  }

  return players.map((player) => {
    const contract = contractsByPlayerId.get(player.id);
    const bucket = normalizePositionBucket(player.position);
    const peers = playersByBucket.get(bucket) ?? [];

    const peerValues = peers
      .map((peer) => {
        const peerContract = contractsByPlayerId.get(peer.id);
        return Math.max(peerContract?.capHit ?? 0, peerContract?.guaranteed ?? 0);
      })
      .sort((a, b) => b - a);

    const marketValue = Math.max(contract?.capHit ?? 0, contract?.guaranteed ?? 0);
    const peerIndex = peerValues.findIndex((value) => marketValue >= value);
    const rank = peerIndex === -1 ? peerValues.length - 1 : peerIndex;
    const percentile = peerValues.length <= 1 ? 0.5 : 1 - rank / Math.max(1, peerValues.length - 1);

    let baseline = 60 + percentile * 35;

    if (player.age !== null && player.age !== undefined) {
      if (player.age >= 25 && player.age <= 29) baseline += 3;
      else if (player.age <= 23) baseline -= 2;
      else if (player.age >= 30 && player.age <= 32) baseline -= 1;
      else if (player.age >= 33) baseline -= 4;
    }

    if (marketValue === 0) {
      baseline = Math.max(baseline - 5, 62);
    }

    const baselineRating = clamp(Math.round(baseline), 60, 99);
    const rating =
      player.maddenRating !== null && player.maddenRating !== undefined
        ? clamp(Math.ceil(baselineRating + (player.maddenRating - baselineRating) / 2), 60, 99)
        : baselineRating;

    return {
      ...player,
      baselineRating,
      rating,
    };
  });
};

const enrichFreeAgentsWithRatings = async (
  freeAgents: UnifiedFreeAgent[],
  players: UnifiedPlayer[],
  maddenRows: MaddenRatingRecord[],
): Promise<UnifiedFreeAgent[]> => {
  const playerLookup = buildFreeAgentPlayerLookup(players);
  const maddenLookup = buildFreeAgentMaddenLookup(maddenRows);
  const espnProfileCache = new Map<
    string,
    Awaited<ReturnType<typeof fetchBestAvailableEspnPlayerProfile>>
  >();

  return Promise.all(
    freeAgents.map(async (freeAgent) => {
      const normalizedName = normalizeFreeAgentName(freeAgent.normalizedName || freeAgent.name);
      const existingExternalId = extractEspnAthleteId(freeAgent.headshotUrl);
      const needsExternalProfile =
        freeAgent.height === null ||
        freeAgent.weight === null ||
        freeAgent.headshotUrl === null ||
        freeAgent.baselineRating === null ||
        freeAgent.maddenRating === null ||
        freeAgent.rating === null ||
        Object.keys(freeAgent.stats ?? {}).length === 0;
      let espnProfile = espnProfileCache.get(freeAgent.id) ?? null;
      if (needsExternalProfile && espnProfile === null) {
        espnProfile = await fetchBestAvailableEspnPlayerProfile({
          name: freeAgent.name,
          position: freeAgent.position,
          age: freeAgent.age,
        }).catch(() => null);
        espnProfileCache.set(freeAgent.id, espnProfile);
      }

      const externalId = existingExternalId ?? espnProfile?.id ?? null;
      const playerMatch = playerLookup.findMatch({
        id: freeAgent.id,
        externalId,
        normalizedName,
        position: freeAgent.position,
      });
      const matchedPlayer = playerMatch?.player ?? null;
      const maddenMatch =
        matchedPlayer === null
          ? maddenLookup.findMatch({
              normalizedName,
              teamAbbr: freeAgent.lastTeamAbbr,
              position: freeAgent.position,
            })
          : null;
      const resolvedBaselineRating =
        matchedPlayer?.baselineRating ??
        freeAgent.baselineRating ??
        (maddenMatch ? generateBaselinePlayerRating() : null);
      const resolvedMaddenRating =
        matchedPlayer?.maddenRating ?? freeAgent.maddenRating ?? maddenMatch?.maddenRating ?? null;
      const resolvedRating =
        matchedPlayer?.rating ??
        freeAgent.rating ??
        (resolvedBaselineRating !== null
          ? blendPlayerRating(resolvedBaselineRating, resolvedMaddenRating)
          : null);

      if (DEBUG_FREE_AGENT_NAMES.has(freeAgent.name)) {
        console.log(
          `[free-agent-ratings] ${JSON.stringify({
            freeAgentId: freeAgent.id,
            normalizedName,
            position: freeAgent.position,
            matchedSourceId: matchedPlayer?.id ?? externalId ?? null,
            matchedBy: playerMatch?.strategy ?? maddenMatch?.strategy ?? 'none',
            baselineRating: resolvedBaselineRating,
            maddenRating: resolvedMaddenRating,
            rating: resolvedRating,
          })}`,
        );
      }

      return {
        ...freeAgent,
        age: matchedPlayer?.age ?? espnProfile?.age ?? freeAgent.age ?? null,
        height: matchedPlayer?.height ?? espnProfile?.height ?? freeAgent.height ?? null,
        weight: matchedPlayer?.weight ?? espnProfile?.weight ?? freeAgent.weight ?? null,
        baselineRating: resolvedBaselineRating,
        maddenRating: resolvedMaddenRating,
        rating: resolvedRating,
        headshotUrl:
          matchedPlayer?.headshotUrl ?? espnProfile?.headshotUrl ?? freeAgent.headshotUrl ?? null,
        stats: matchedPlayer
          ? { ...matchedPlayer.stats }
          : espnProfile
            ? { ...espnProfile.stats }
            : (freeAgent.stats ?? {}),
      };
    }),
  );
};

const run = async () => {
  const now = new Date().toISOString();

  const playerSync = await syncPlayers();
  const capSync = await syncCap();
  const contractSync = await syncContracts(playerSync.teams, playerSync.players);
  const enrichedPlayers = buildRatedPlayers(playerSync.players, contractSync.contracts);
  const enrichedFreeAgents = await enrichFreeAgentsWithRatings(
    contractSync.freeAgents,
    enrichedPlayers,
    playerSync.maddenRows,
  );

  const payload: IngestedLeagueData = {
    updatedAt: now,
    teams: playerSync.teams,
    players: enrichedPlayers,
    contracts: contractSync.contracts,
    freeAgents: enrichedFreeAgents,
    cap: capSync.cap,
  };

  const teamsWithPlayers = new Set(payload.players.map((player) => player.teamAbbr));
  const teamsWithoutPlayers = payload.teams.filter((team) => !teamsWithPlayers.has(team.abbr));
  const contractPlayerIds = new Set(payload.players.map((player) => player.id));
  const expiring = buildRosterMatchedExpiringContracts({
    players: payload.players,
    contracts: payload.contracts,
    seasonYear: OFFSEASON_EXPIRING_SEASON_YEAR,
  });
  const expiringContractsCount = expiring.endingThisSeason.length;
  logExpiringDebugSamples({
    players: payload.players,
    contracts: payload.contracts,
    freeAgents: payload.freeAgents,
    expiringPlayerIds: new Set(expiring.endingThisSeason.map((contract) => contract.playerId)),
  });
  const unmatchedContracts = payload.contracts.filter(
    (contract) => !contractPlayerIds.has(contract.playerId),
  );

  await mkdir(path.dirname(DATA_FILE), { recursive: true });
  await writeFile(DATA_FILE, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  console.log('sync summary');
  console.log(`teams count: ${payload.teams.length}`);
  console.log(`players count: ${payload.players.length}`);
  console.log(`contracts count: ${payload.contracts.length}`);
  console.log(`cap entries count: ${payload.cap.length}`);
  console.log(`[expiring] rostered players=${expiring.rosteredPlayers.length}`);
  console.log(`[expiring] matched contracts=${expiring.matchedContracts.length}`);
  console.log(
    `[expiring] contracts with derived final year=${expiring.contractsWithDerivedFinalYear}`,
  );
  console.log(
    `[expiring] final year ${OFFSEASON_EXPIRING_SEASON_YEAR} count=${expiring.finalYearForSeasonCount}`,
  );
  console.log(
    `[expiring] final year distribution=${JSON.stringify(expiring.finalYearDistribution)}`,
  );
  console.log(
    `[expiring] ending after ${OFFSEASON_EXPIRING_SEASON_YEAR} season=${expiring.endingThisSeason.length}`,
  );
  console.log(`[expiring] expiring contracts count=${expiringContractsCount}`);
  console.log(`[expiring] sample=${JSON.stringify(expiring.sample)}`);
  console.log(`free agents count: ${payload.freeAgents.length}`);
  console.log(`expiring contracts count: ${expiringContractsCount}`);
  console.log(`teams without players: ${teamsWithoutPlayers.length}`);
  console.log(`contracts without matching players: ${unmatchedContracts.length}`);
  console.log(
    `[contracts] rows=${contractSync.report.totalContractRows} matched=${contractSync.report.matchedPlayers} unmatched=${contractSync.report.unmatchedPlayers} conflicts=${contractSync.report.duplicateMatchConflicts} missingTeams=${contractSync.report.teamsWithMissingContractPages.length}`,
  );
  console.log(`[players] rosterErrors=${playerSync.rosterErrors.length}`);
  console.log(
    `[madden] rows=${playerSync.maddenReport.fetchedRows} matched=${playerSync.maddenReport.matchedPlayers} unmatched=${playerSync.maddenReport.unmatchedRows}`,
  );
  if (playerSync.maddenReport.sampleBlends.length > 0) {
    console.log('[madden] blend samples');
    playerSync.maddenReport.sampleBlends.forEach((sample) => {
      console.log(
        `  ${sample.teamAbbr} ${sample.name}: baseline=${sample.baselineRating} madden=${sample.maddenRating} final=${sample.rating}`,
      );
    });
  }
  console.log(`[cap] unmatched=${capSync.unmatched.length}`);
};

run().catch((error) => {
  console.error(`sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  process.exitCode = 1;
});
