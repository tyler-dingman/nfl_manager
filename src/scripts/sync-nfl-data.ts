import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type {
  IngestedLeagueData,
  UnifiedContract,
  UnifiedFreeAgent,
  UnifiedPlayer,
} from '@/server/data/nfl-data';
import type { DraftProspectRecord } from '@/server/data/draft-prospects';
import {
  fetchConsensusBigBoardRankings,
  fetchPffBigBoardRankings,
  type ExternalDraftRankingRecord,
} from '@/server/data-sources/consensus-draft';
import {
  type DraftBoardRankingRecord,
  fetchEspnDraftBoardRankings,
  fetchEspnDraftProspectProfile,
  resolveEspnDraftProspectProfile,
} from '@/server/data-sources/espn-draft';
import { fetchBestAvailableEspnPlayerProfile } from '@/server/data-sources/espn';
import {
  buildMaddenPlayerKey,
  type MaddenRatingRecord,
} from '@/server/data-sources/madden-ratings';
import {
  generateDraftProspectSummary,
  getProjectedRangeFromRanking,
  inferDraftProspectArchetype,
} from '@/lib/draft-prospect-enrichment';
import { syncCap } from '@/server/ingest/cap';
import { syncContracts } from '@/server/ingest/contracts';
import { normalizePlayerName } from '@/server/ingest/normalize';
import { syncPlayers } from '@/server/ingest/players';
import { blendPlayerRating, generateBaselinePlayerRating } from '@/server/ingest/ratings';
import {
  buildRosterMatchedExpiringContracts,
  OFFSEASON_EXPIRING_SEASON_YEAR,
} from '@/server/logic/contract-expiration';
import {
  computeOverviewGrade,
  computeTeamNeeds,
  computeTeamOverviewRaw,
  scaleOverviewScore,
} from '@/server/logic/team-overview';
import {
  fetchTeamNeedsFromNflMockDraftDatabase,
  type TeamNeedsRecord,
} from '@/server/data-sources/team-needs';

const DATA_FILE = path.join(process.cwd(), 'src/server/data/nfl-data.json');
const DRAFT_PROSPECTS_FILE = path.join(process.cwd(), 'src/server/data/draft-prospects.json');
const DRAFT_CACHE_DIR = path.join(process.cwd(), 'src/server/data-cache');
const ESPN_DRAFT_BOARD_CACHE_FILE = path.join(DRAFT_CACHE_DIR, 'espn-draft-board.json');
const PFF_DRAFT_BOARD_CACHE_FILE = path.join(DRAFT_CACHE_DIR, 'pff-draft-board.json');
const CONSENSUS_DRAFT_BOARD_CACHE_FILE = path.join(DRAFT_CACHE_DIR, 'consensus-draft-board.json');
const MERGED_DRAFT_BOARD_CACHE_FILE = path.join(DRAFT_CACHE_DIR, 'merged-draft-board.json');
const DRAFT_PROFILE_CACHE_FILE = path.join(DRAFT_CACHE_DIR, 'espn-draft-profiles.json');
const TEAM_NEEDS_CACHE_FILE = path.join(DRAFT_CACHE_DIR, 'team-needs.json');
const TARGET_BIG_BOARD_SIZE = 320;
const MINIMUM_DRAFT_BOARD_SIZE = 280;
const MAX_ESPn_PROFILE_ENRICHMENT = 140;
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

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const readJsonIfPresent = async <T>(filePath: string): Promise<T | null> => {
  try {
    const value = await readFile(filePath, 'utf8');
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

const buildTeamNeedsLookup = (records: TeamNeedsRecord[]) =>
  new Map(records.map((record) => [record.teamAbbr, record] as const));

const inferFallbackTeamNeeds = (rosteredPlayers: UnifiedPlayer[], teamAbbr: string, teamName: string) => {
  const allNeeds = computeTeamNeeds(rosteredPlayers, 5);

  return {
    teamAbbr,
    teamName,
    topNeeds: allNeeds.slice(0, 3),
    allNeeds,
  } satisfies TeamNeedsRecord;
};

const loadTeamNeedsRecords = async () => {
  try {
    const records = await fetchTeamNeedsFromNflMockDraftDatabase();
    return {
      records,
      source: 'nfl-mock-draft-database' as const,
    };
  } catch (error) {
    const cached = await readJsonIfPresent<TeamNeedsCachePayload>(TEAM_NEEDS_CACHE_FILE);
    if (cached) {
      return {
        records: Object.values(cached),
        source: 'cache' as const,
      };
    }

    console.warn(
      `[team-needs] falling back to roster inference because team-needs sync failed: ${
        error instanceof Error ? error.message : 'unknown error'
      }`,
    );
    return {
      records: [] as TeamNeedsRecord[],
      source: 'roster-inference' as const,
    };
  }
};

type DraftProfileCache = Record<string, DraftProspectRecord>;

type ConsensusDraftProspectSeed = {
  name: string;
  normalizedName: string;
  school: string | null;
  position: string | null;
  sourceRanks: {
    pff: number | null;
    espn: number | null;
    consensus: number | null;
  };
  averageRank: number | null;
  confidence: 'high' | 'medium' | 'low';
};

type RankedConsensusDraftProspectSeed = ConsensusDraftProspectSeed & {
  ranking: number;
};

type DraftBoardCachePayload = Array<{
  ranking: number | null;
  grade?: string | null;
  name: string;
  normalizedName: string;
  school: string | null;
  position: string | null;
  headshotUrl?: string | null;
  espnPlayerId?: string | null;
  espnProfileUrl?: string | null;
  height?: string | null;
  weight?: number | null;
  source?: string | null;
  sourceRanks?: {
    pff: number | null;
    espn: number | null;
    consensus: number | null;
  };
  averageRank?: number | null;
  confidence?: 'high' | 'medium' | 'low';
}>;

type FreeAgentLookupMatch = {
  player: UnifiedPlayer;
  strategy: 'id' | 'externalId' | 'normalizedName+position' | 'normalizedName';
};

type TeamNeedsCachePayload = Record<
  string,
  {
    teamAbbr: string;
    teamName: string;
    topNeeds: string[];
    allNeeds: string[];
  }
>;

const normalizeSchoolName = (value: string | null | undefined) =>
  (value ?? '')
    .toLowerCase()
    .replace(/[().']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\bsaint\b/g, 'st')
    .replace(/\bstate\b/g, 'st')
    .trim();

const weightedAverage = (entries: Array<{ rank: number | null; weight: number }>) => {
  const usable = entries.filter(
    (entry): entry is { rank: number; weight: number } =>
      entry.rank !== null && Number.isFinite(entry.rank),
  );
  if (usable.length === 0) {
    return null;
  }

  const totalWeight = usable.reduce((sum, entry) => sum + entry.weight, 0);
  const total = usable.reduce((sum, entry) => sum + entry.rank * entry.weight, 0);
  return Number((total / totalWeight).toFixed(2));
};

const inferDraftConfidence = (sourceRanks: ConsensusDraftProspectSeed['sourceRanks']) => {
  const sourceCount = Object.values(sourceRanks).filter((value) => value !== null).length;
  if (sourceCount >= 3) return 'high';
  if (sourceCount === 2) return 'medium';
  return 'low';
};

const getBestSourceRank = (sourceRanks: ConsensusDraftProspectSeed['sourceRanks']) =>
  Math.min(
    ...(Object.values(sourceRanks).filter((value): value is number => value !== null) || [999]),
  );

const resolveConsensusKey = (
  entries: Map<string, ConsensusDraftProspectSeed>,
  candidate: { normalizedName: string; school: string | null },
) => {
  const normalizedSchool = normalizeSchoolName(candidate.school);
  const directKey = normalizedSchool
    ? `${candidate.normalizedName}::${normalizedSchool}`
    : candidate.normalizedName;
  if (entries.has(directKey)) {
    return directKey;
  }

  const byName = [...entries.entries()].filter(([, value]) => {
    if (value.normalizedName !== candidate.normalizedName) {
      return false;
    }
    if (!normalizedSchool) {
      return true;
    }
    return normalizeSchoolName(value.school) === normalizedSchool;
  });

  if (byName.length === 1) {
    return byName[0]?.[0] ?? directKey;
  }

  const sameNameOnly = [...entries.entries()].filter(
    ([, value]) => value.normalizedName === candidate.normalizedName,
  );
  if (sameNameOnly.length === 1) {
    return sameNameOnly[0]?.[0] ?? directKey;
  }

  return directKey;
};

const mergeConsensusBoard = ({
  espnRankings,
  pffRankings,
  consensusRankings,
}: {
  espnRankings: DraftBoardRankingRecord[];
  pffRankings: ExternalDraftRankingRecord[];
  consensusRankings: ExternalDraftRankingRecord[];
}): RankedConsensusDraftProspectSeed[] => {
  const merged = new Map<string, ConsensusDraftProspectSeed>();
  const ingest = (
    entry: {
      ranking: number | null;
      name: string;
      normalizedName: string;
      school: string | null;
      position: string | null;
    },
    source: keyof ConsensusDraftProspectSeed['sourceRanks'],
  ) => {
    if (!entry.name.trim()) {
      return;
    }

    const key = resolveConsensusKey(merged, entry);
    const existing = merged.get(key);
    const nextSourceRanks = {
      pff: existing?.sourceRanks.pff ?? null,
      espn: existing?.sourceRanks.espn ?? null,
      consensus: existing?.sourceRanks.consensus ?? null,
      [source]: entry.ranking,
    };
    const seed: ConsensusDraftProspectSeed = {
      name: existing?.name ?? entry.name,
      normalizedName: entry.normalizedName,
      school: existing?.school ?? entry.school,
      position: existing?.position ?? entry.position,
      sourceRanks: nextSourceRanks,
      averageRank:
        weightedAverage([
          { rank: nextSourceRanks.pff, weight: 1.2 },
          { rank: nextSourceRanks.espn, weight: 1.0 },
          { rank: nextSourceRanks.consensus, weight: 1.0 },
        ]) ?? 999,
      confidence: inferDraftConfidence(nextSourceRanks),
    };

    merged.set(key, seed);
  };

  espnRankings.forEach((entry) => ingest(entry, 'espn'));
  pffRankings.forEach((entry) => ingest(entry, 'pff'));
  consensusRankings.forEach((entry) => ingest(entry, 'consensus'));

  return [...merged.values()]
    .sort((left, right) => {
      const averageDelta =
        (left.averageRank ?? Number.MAX_SAFE_INTEGER) - (right.averageRank ?? Number.MAX_SAFE_INTEGER);
      if (averageDelta !== 0) return averageDelta;
      const bestRankDelta = getBestSourceRank(left.sourceRanks) - getBestSourceRank(right.sourceRanks);
      if (bestRankDelta !== 0) return bestRankDelta;
      return left.name.localeCompare(right.name);
    })
    .map((entry, index) => ({
      ...entry,
      averageRank: entry.averageRank ?? 999,
      ranking: index + 1,
    }));
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

const seedDraftProspectFallbacks = async (): Promise<DraftProspectRecord[]> => {
  const { TOP_50_PROSPECTS } = await import('@/server/data/prospects-top32');
  return TOP_50_PROSPECTS.map((prospect) => {
    const stableId = prospect.id || `${slugify(prospect.name)}-${slugify(prospect.college)}`;
    const projectedRange = getProjectedRangeFromRanking(prospect.rank);
    const archetype = inferDraftProspectArchetype({
      position: prospect.position,
      stats: {},
      weight: null,
    });

    return {
      id: stableId,
      name: prospect.name,
      normalizedName: normalizePlayerName(prospect.name),
      school: prospect.college,
      position: prospect.position,
      ranking: prospect.rank,
      sourceRanks: {
        pff: null,
        espn: prospect.rank,
        consensus: null,
      },
      averageRank: prospect.rank,
      confidence: 'low',
      espnPlayerId: null,
      espnProfileUrl: null,
      headshotUrl: null,
      age: null,
      classYear: null,
      height: null,
      weight: null,
      hometown: null,
      stats: {},
      summary: generateDraftProspectSummary({
        name: prospect.name,
        ranking: prospect.rank,
        school: prospect.college,
        position: prospect.position,
        classYear: null,
        height: null,
        weight: null,
        stats: {},
        archetype,
      }),
      archetype,
      projectedRange,
      source: 'falco-seed-fallback',
      grade: (95 - (prospect.rank - 1) * 0.3).toFixed(1),
      projectedPick: prospect.rank,
    };
  });
};

const generateFillerDraftProspects = (
  startRank: number,
  count: number,
): DraftProspectRecord[] => {
  const positions = ['QB', 'RB', 'WR', 'TE', 'OT', 'IOL', 'EDGE', 'DL', 'LB', 'CB', 'S'];
  const schools = [
    'Northern Iowa',
    'Coastal Carolina',
    'Liberty',
    'App State',
    'Fresno State',
    'Tulane',
    'Toledo',
    'Boise State',
    'Memphis',
    'South Alabama',
  ];

  return Array.from({ length: count }, (_, index) => {
    const ranking = startRank + index;
    const position = positions[index % positions.length] ?? 'ATH';
    const school = schools[index % schools.length] ?? 'Program TBD';
    const name = `Five Wide Prospect ${ranking}`;
    const archetype = inferDraftProspectArchetype({
      position,
      stats: {},
      weight: null,
    });

    return {
      id: `falco-prospect-${ranking}`,
      name,
      normalizedName: normalizePlayerName(name),
      school,
      position,
      ranking,
      sourceRanks: {
        pff: null,
        espn: null,
        consensus: null,
      },
      averageRank: 999,
      confidence: 'low',
      espnPlayerId: null,
      espnProfileUrl: null,
      headshotUrl: null,
      age: 22,
      classYear: 'SR',
      height: null,
      weight: null,
      hometown: null,
      stats: {},
      summary: generateDraftProspectSummary({
        name,
        ranking,
        school,
        position,
        classYear: 'SR',
        height: null,
        weight: null,
        stats: {},
        archetype,
      }),
      archetype,
      projectedRange: getProjectedRangeFromRanking(ranking),
      source: 'generated-filler',
      grade: (73 - Math.min(index, 20) * 0.2).toFixed(1),
      projectedPick: ranking,
    };
  });
};

const buildDraftProfileCacheFromProspects = (prospects: DraftProspectRecord[]): DraftProfileCache =>
  Object.fromEntries(
    prospects
      .filter((prospect) => Boolean(prospect.espnPlayerId))
      .map((prospect) => [prospect.espnPlayerId as string, prospect]),
  );

const enrichDraftProspects = async (): Promise<{
  prospects: DraftProspectRecord[];
  sourceCounts: {
    espn: number;
    pff: number;
    consensus: number;
  };
  resolvedCount: number;
  unmatchedCount: number;
  headshotMissingCount: number;
  rankingMissingCount: number;
  summaryCount: number;
  sample: Array<{
    ranking: number | null;
    name: string;
    school: string | null;
    espnPlayerId: string | null;
    hasHeadshot: boolean;
    summary: string | null;
  }>;
}> => {
  const espnBoardCache =
    (await readJsonIfPresent<Awaited<ReturnType<typeof fetchEspnDraftBoardRankings>>>(
      ESPN_DRAFT_BOARD_CACHE_FILE,
    )) ?? [];
  const pffBoardCache =
    (await readJsonIfPresent<Awaited<ReturnType<typeof fetchPffBigBoardRankings>>>(
      PFF_DRAFT_BOARD_CACHE_FILE,
    )) ?? [];
  const consensusBoardCache =
    (await readJsonIfPresent<Awaited<ReturnType<typeof fetchConsensusBigBoardRankings>>>(
      CONSENSUS_DRAFT_BOARD_CACHE_FILE,
    )) ?? [];
  const mergedBoardCache = (await readJsonIfPresent<DraftBoardCachePayload>(
    MERGED_DRAFT_BOARD_CACHE_FILE,
  )) ?? [];
  const profileCache = (await readJsonIfPresent<DraftProfileCache>(DRAFT_PROFILE_CACHE_FILE)) ?? {};

  let espnRankings: Awaited<ReturnType<typeof fetchEspnDraftBoardRankings>> = [];
  try {
    espnRankings = await fetchEspnDraftBoardRankings();
  } catch {
    espnRankings = espnBoardCache;
  }

  let pffRankings: Awaited<ReturnType<typeof fetchPffBigBoardRankings>> = [];
  try {
    pffRankings = await fetchPffBigBoardRankings();
  } catch {
    pffRankings = pffBoardCache;
  }

  let consensusRankings: Awaited<ReturnType<typeof fetchConsensusBigBoardRankings>> = [];
  try {
    consensusRankings = await fetchConsensusBigBoardRankings();
  } catch {
    consensusRankings = consensusBoardCache;
  }

  const mergedBoard =
    espnRankings.length || pffRankings.length || consensusRankings.length
      ? mergeConsensusBoard({
          espnRankings,
          pffRankings,
          consensusRankings,
        })
      : mergedBoardCache.map((entry, index) => ({
          name: entry.name,
          normalizedName: entry.normalizedName,
          school: entry.school,
          position: entry.position,
          sourceRanks: entry.sourceRanks ?? {
            pff: null,
            espn: entry.ranking,
            consensus: null,
          },
          averageRank: entry.averageRank ?? entry.ranking ?? index + 1,
          confidence: entry.confidence ?? 'low',
          ranking: entry.ranking ?? index + 1,
        }));

  if (!mergedBoard.length) {
    const fallback = await seedDraftProspectFallbacks();
    return {
      prospects: fallback,
      sourceCounts: {
        espn: 0,
        pff: 0,
        consensus: 0,
      },
      resolvedCount: 0,
      unmatchedCount: fallback.length,
      headshotMissingCount: fallback.filter((prospect) => !prospect.headshotUrl).length,
      rankingMissingCount: fallback.filter((prospect) => prospect.ranking === null).length,
      summaryCount: fallback.filter((prospect) => Boolean(prospect.summary)).length,
      sample: fallback.slice(0, 10).map((prospect) => ({
        ranking: prospect.ranking,
        name: prospect.name,
        school: prospect.school,
        espnPlayerId: prospect.espnPlayerId,
        hasHeadshot: Boolean(prospect.headshotUrl),
        summary: prospect.summary,
      })),
    };
  }

  const espnRankingsByName = new Map(espnRankings.map((entry) => [entry.normalizedName, entry]));
  const prospects: DraftProspectRecord[] = [];
  let resolvedCount = 0;

  for (const [index, rankingEntry] of mergedBoard.slice(0, TARGET_BIG_BOARD_SIZE).entries()) {
    const espnBoardEntry =
      espnRankingsByName.get(rankingEntry.normalizedName) ??
      espnRankings.find((entry) => {
        if (entry.normalizedName !== rankingEntry.normalizedName) {
          return false;
        }
        if (!entry.school || !rankingEntry.school) {
          return true;
        }
        return normalizeSchoolName(entry.school) === normalizeSchoolName(rankingEntry.school);
      }) ??
      null;

    const shouldAttemptEspnEnrichment =
      index < MAX_ESPn_PROFILE_ENRICHMENT || Boolean(espnBoardEntry?.espnPlayerId);
    const resolver = shouldAttemptEspnEnrichment
      ? await resolveEspnDraftProspectProfile({
          name: rankingEntry.name,
          school: rankingEntry.school,
          position: rankingEntry.position,
          boardEspnPlayerId: espnBoardEntry?.espnPlayerId,
          boardEspnProfileUrl: espnBoardEntry?.espnProfileUrl,
        }).catch(() => null)
      : null;

    let prospect: DraftProspectRecord | null = null;

    if (resolver?.espnPlayerId && profileCache[resolver.espnPlayerId]) {
      prospect = {
        ...profileCache[resolver.espnPlayerId],
        name: rankingEntry.name,
        normalizedName: rankingEntry.normalizedName,
        school: rankingEntry.school ?? profileCache[resolver.espnPlayerId]?.school ?? null,
        position: rankingEntry.position ?? profileCache[resolver.espnPlayerId]?.position ?? null,
        ranking: rankingEntry.ranking,
        sourceRanks: rankingEntry.sourceRanks,
        averageRank: rankingEntry.averageRank,
        confidence: rankingEntry.confidence,
        projectedRange: getProjectedRangeFromRanking(rankingEntry.ranking),
        projectedPick: rankingEntry.ranking,
        source: 'consensus-big-board+espn-profile-cache',
      };
      resolvedCount += 1;
    } else if (resolver?.espnPlayerId) {
      const profile = await fetchEspnDraftProspectProfile(resolver.espnPlayerId).catch(() => null);
      if (profile) {
        const school = rankingEntry.school ?? profile.school;
        const stableId = `${slugify(rankingEntry.name)}-${slugify(school ?? 'unknown')}`;
        const archetype = inferDraftProspectArchetype({
          position: rankingEntry.position ?? profile.position,
          stats: profile.stats,
          weight: espnBoardEntry?.weight ?? profile.weight,
        });

        prospect = {
          id: stableId,
          name: rankingEntry.name,
          normalizedName: rankingEntry.normalizedName,
          school,
          position: rankingEntry.position ?? profile.position,
          ranking: rankingEntry.ranking,
          sourceRanks: rankingEntry.sourceRanks,
          averageRank: rankingEntry.averageRank,
          confidence: rankingEntry.confidence,
          espnPlayerId: resolver.espnPlayerId,
          espnProfileUrl: resolver.espnProfileUrl ?? profile.espnProfileUrl,
          headshotUrl: espnBoardEntry?.headshotUrl ?? profile.headshotUrl,
          age: profile.age,
          classYear: profile.classYear,
          height: espnBoardEntry?.height ?? profile.height,
          weight: espnBoardEntry?.weight ?? profile.weight,
          hometown: profile.hometown,
          stats: profile.stats,
          summary: generateDraftProspectSummary({
            name: rankingEntry.name,
            ranking: rankingEntry.ranking,
            school,
            position: rankingEntry.position ?? profile.position,
            classYear: profile.classYear,
            height: espnBoardEntry?.height ?? profile.height,
            weight: espnBoardEntry?.weight ?? profile.weight,
            stats: profile.stats,
            archetype,
          }),
          archetype,
          projectedRange: getProjectedRangeFromRanking(rankingEntry.ranking),
          source:
            resolver.source === 'board' ? 'consensus-big-board+espn-athlete' : 'consensus-big-board+search+espn-athlete',
          grade: espnBoardEntry?.grade ?? null,
          projectedPick: rankingEntry.ranking,
        };
        resolvedCount += 1;
      }
    }

    if (!prospect) {
      const school = rankingEntry.school;
      const stableId = `${slugify(rankingEntry.name)}-${slugify(school ?? 'unknown')}`;
      const archetype = inferDraftProspectArchetype({
        position: rankingEntry.position,
        stats: {},
        weight: espnBoardEntry?.weight ?? null,
      });

      prospect = {
        id: stableId,
        name: rankingEntry.name,
        normalizedName: rankingEntry.normalizedName,
        school,
        position: rankingEntry.position,
        ranking: rankingEntry.ranking,
        sourceRanks: rankingEntry.sourceRanks,
        averageRank: rankingEntry.averageRank,
        confidence: rankingEntry.confidence,
        espnPlayerId: resolver?.espnPlayerId ?? espnBoardEntry?.espnPlayerId ?? null,
        espnProfileUrl: resolver?.espnProfileUrl ?? espnBoardEntry?.espnProfileUrl ?? null,
        headshotUrl: espnBoardEntry?.headshotUrl ?? null,
        age: null,
        classYear: null,
        height: espnBoardEntry?.height ?? null,
        weight: espnBoardEntry?.weight ?? null,
        hometown: null,
        stats: {},
        summary: generateDraftProspectSummary({
          name: rankingEntry.name,
          ranking: rankingEntry.ranking,
          school,
          position: rankingEntry.position,
          classYear: null,
          height: espnBoardEntry?.height ?? null,
          weight: espnBoardEntry?.weight ?? null,
          stats: {},
          archetype,
        }),
        archetype,
        projectedRange: getProjectedRangeFromRanking(rankingEntry.ranking),
        source: 'consensus-big-board',
        grade: espnBoardEntry?.grade ?? null,
        projectedPick: rankingEntry.ranking,
      };
    }

    prospects.push(prospect);
  }

  if (prospects.length < MINIMUM_DRAFT_BOARD_SIZE) {
    prospects.push(
      ...generateFillerDraftProspects(
        prospects.length + 1,
        MINIMUM_DRAFT_BOARD_SIZE - prospects.length,
      ),
    );
  }

  prospects.sort(
    (a, b) =>
      (a.ranking ?? Number.MAX_SAFE_INTEGER) - (b.ranking ?? Number.MAX_SAFE_INTEGER) ||
      a.name.localeCompare(b.name),
  );

  return {
    prospects,
    sourceCounts: {
      espn: espnRankings.length,
      pff: pffRankings.length,
      consensus: consensusRankings.length,
    },
    resolvedCount,
    unmatchedCount: prospects.length - resolvedCount,
    headshotMissingCount: prospects.filter((prospect) => !prospect.headshotUrl).length,
    rankingMissingCount: prospects.filter((prospect) => prospect.ranking === null).length,
    summaryCount: prospects.filter((prospect) => Boolean(prospect.summary)).length,
    sample: prospects.slice(0, 10).map((prospect) => ({
      ranking: prospect.ranking,
      name: prospect.name,
      school: prospect.school,
      espnPlayerId: prospect.espnPlayerId,
      hasHeadshot: Boolean(prospect.headshotUrl),
      summary: prospect.summary,
    })),
  };
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
  const teamNeedsSync = await loadTeamNeedsRecords();
  const scrapedTeamNeeds = buildTeamNeedsLookup(teamNeedsSync.records);
  const teamOverviewProfiles = playerSync.teams.map((team) => {
    const rosteredPlayers = enrichedPlayers.filter((player) => player.teamAbbr === team.abbr);
    const overview = computeTeamOverviewRaw(rosteredPlayers);
    const fallbackNeeds = inferFallbackTeamNeeds(rosteredPlayers, team.abbr, team.name);
    const normalizedNeeds = scrapedTeamNeeds.get(team.abbr) ?? fallbackNeeds;

    return {
      team,
      overview,
      topNeeds: normalizedNeeds.topNeeds,
      allNeeds: normalizedNeeds.allNeeds,
    };
  });
  const overallRawValues = teamOverviewProfiles.map((entry) => entry.overview.overall);
  const offenseRawValues = teamOverviewProfiles.map((entry) => entry.overview.offense);
  const defenseRawValues = teamOverviewProfiles.map((entry) => entry.overview.defense);
  const specialTeamsRawValues = teamOverviewProfiles.map((entry) => entry.overview.specialTeams);
  const minOverallRaw = Math.min(...overallRawValues);
  const maxOverallRaw = Math.max(...overallRawValues);
  const minOffenseRaw = Math.min(...offenseRawValues);
  const maxOffenseRaw = Math.max(...offenseRawValues);
  const minDefenseRaw = Math.min(...defenseRawValues);
  const maxDefenseRaw = Math.max(...defenseRawValues);
  const minSpecialTeamsRaw = Math.min(...specialTeamsRawValues);
  const maxSpecialTeamsRaw = Math.max(...specialTeamsRawValues);
  const enrichedTeams = teamOverviewProfiles.map(({ team, overview, topNeeds, allNeeds }) => {
    const teamOverview = scaleOverviewScore(overview.overall, minOverallRaw, maxOverallRaw, 69, 91);
    const offenseOverview = scaleOverviewScore(
      overview.offense,
      minOffenseRaw,
      maxOffenseRaw,
      68,
      91,
    );
    const defenseOverview = scaleOverviewScore(
      overview.defense,
      minDefenseRaw,
      maxDefenseRaw,
      68,
      91,
    );
    const specialTeamsOverview = scaleOverviewScore(
      overview.specialTeams,
      minSpecialTeamsRaw,
      maxSpecialTeamsRaw,
      65,
      90,
    );

    return {
      ...team,
      teamOverviewRaw: overview.overall,
      offenseOverviewRaw: overview.offense,
      defenseOverviewRaw: overview.defense,
      specialTeamsOverviewRaw: overview.specialTeams,
      teamOverview,
      offenseOverview,
      defenseOverview,
      specialTeamsOverview,
      teamOverviewGrade: computeOverviewGrade(teamOverview),
      teamNeeds: topNeeds,
      allTeamNeeds: allNeeds,
    };
  });

  const payload: IngestedLeagueData = {
    updatedAt: now,
    teams: enrichedTeams,
    players: enrichedPlayers,
    contracts: contractSync.contracts,
    freeAgents: enrichedFreeAgents,
    cap: capSync.cap,
  };
  const draftProspectSync = await enrichDraftProspects();

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
  const sortedTeamOverviews = [...payload.teams].sort(
    (a, b) => (b.teamOverview ?? 0) - (a.teamOverview ?? 0) || a.name.localeCompare(b.name),
  );

  await mkdir(path.dirname(DATA_FILE), { recursive: true });
  await mkdir(DRAFT_CACHE_DIR, { recursive: true });
  await writeFile(DATA_FILE, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  await writeFile(
    DRAFT_PROSPECTS_FILE,
    `${JSON.stringify(draftProspectSync.prospects, null, 2)}\n`,
    'utf8',
  );
  await writeFile(
    ESPN_DRAFT_BOARD_CACHE_FILE,
    `${JSON.stringify(
      draftProspectSync.prospects.map((prospect) => ({
        ranking: prospect.sourceRanks.espn ?? prospect.ranking,
        grade: prospect.grade,
        name: prospect.name,
        normalizedName: prospect.normalizedName,
        school: prospect.school,
        position: prospect.position,
        headshotUrl: prospect.headshotUrl,
        espnPlayerId: prospect.espnPlayerId,
        espnProfileUrl: prospect.espnProfileUrl,
        height: prospect.height,
        weight: prospect.weight,
        source: prospect.source,
      })),
      null,
      2,
    )}\n`,
    'utf8',
  );
  await writeFile(
    PFF_DRAFT_BOARD_CACHE_FILE,
    `${JSON.stringify(
      draftProspectSync.prospects
        .filter((prospect) => prospect.sourceRanks.pff !== null)
        .map((prospect) => ({
          ranking: prospect.sourceRanks.pff,
          name: prospect.name,
          normalizedName: prospect.normalizedName,
          school: prospect.school,
          position: prospect.position,
          source: 'pff',
        })),
      null,
      2,
    )}\n`,
    'utf8',
  );
  await writeFile(
    CONSENSUS_DRAFT_BOARD_CACHE_FILE,
    `${JSON.stringify(
      draftProspectSync.prospects
        .filter((prospect) => prospect.sourceRanks.consensus !== null)
        .map((prospect) => ({
          ranking: prospect.sourceRanks.consensus,
          name: prospect.name,
          normalizedName: prospect.normalizedName,
          school: prospect.school,
          position: prospect.position,
          source: 'consensus',
        })),
      null,
      2,
    )}\n`,
    'utf8',
  );
  await writeFile(
    MERGED_DRAFT_BOARD_CACHE_FILE,
    `${JSON.stringify(
      draftProspectSync.prospects.map((prospect) => ({
        ranking: prospect.ranking,
        grade: prospect.grade,
        name: prospect.name,
        normalizedName: prospect.normalizedName,
        school: prospect.school,
        position: prospect.position,
        headshotUrl: prospect.headshotUrl,
        espnPlayerId: prospect.espnPlayerId,
        espnProfileUrl: prospect.espnProfileUrl,
        height: prospect.height,
        weight: prospect.weight,
        source: prospect.source,
        sourceRanks: prospect.sourceRanks,
        averageRank: prospect.averageRank,
        confidence: prospect.confidence,
      })),
      null,
      2,
    )}\n`,
    'utf8',
  );
  await writeFile(
    DRAFT_PROFILE_CACHE_FILE,
    `${JSON.stringify(buildDraftProfileCacheFromProspects(draftProspectSync.prospects), null, 2)}\n`,
    'utf8',
  );
  await writeFile(
    TEAM_NEEDS_CACHE_FILE,
    `${JSON.stringify(
      Object.fromEntries(
        enrichedTeams.map((team) => [
          team.abbr,
          {
            teamAbbr: team.abbr,
            teamName: team.name,
            topNeeds: team.teamNeeds ?? [],
            allNeeds: team.allTeamNeeds ?? team.teamNeeds ?? [],
          },
        ]),
      ),
      null,
      2,
    )}\n`,
    'utf8',
  );

  console.log('sync summary');
  console.log(`teams count: ${payload.teams.length}`);
  console.log(`players count: ${payload.players.length}`);
  console.log(`contracts count: ${payload.contracts.length}`);
  console.log(`cap entries count: ${payload.cap.length}`);
  console.log(
    `[team-needs] source=${teamNeedsSync.source} teams=${enrichedTeams.length} sample=${JSON.stringify(
      enrichedTeams.slice(0, 5).map((team) => ({
        abbr: team.abbr,
        topNeeds: team.teamNeeds ?? [],
      })),
    )}`,
  );
  console.log('[team-overview] summary');
  sortedTeamOverviews.forEach((team) => {
    console.log(
      `[team-overview] ${team.name}: overall=${team.teamOverview} offense=${team.offenseOverview} defense=${team.defenseOverview} specialTeams=${team.specialTeamsOverview} grade=${team.teamOverviewGrade} needs=${(team.teamNeeds ?? []).join('/')}`,
    );
  });
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
  console.log(`[draft-prospects] rankings ingested=${draftProspectSync.prospects.length}`);
  console.log(
    `[draft-prospects] board sources espn=${draftProspectSync.sourceCounts.espn} pff=${draftProspectSync.sourceCounts.pff} consensus=${draftProspectSync.sourceCounts.consensus}`,
  );
  console.log(`[draft-prospects] resolved espn profiles=${draftProspectSync.resolvedCount}`);
  console.log(`[draft-prospects] unmatched prospects=${draftProspectSync.unmatchedCount}`);
  console.log(`[draft-prospects] missing headshots=${draftProspectSync.headshotMissingCount}`);
  console.log(`[draft-prospects] missing rankings=${draftProspectSync.rankingMissingCount}`);
  console.log(`[draft-prospects] summaries generated=${draftProspectSync.summaryCount}`);
  console.log('[draft-prospects] sample');
  draftProspectSync.sample.forEach((prospect) => {
    console.log(
      `  rank=${prospect.ranking ?? '--'} name=${prospect.name} school=${prospect.school ?? '—'} espnPlayerId=${prospect.espnPlayerId ?? '—'} headshot=${prospect.hasHeadshot ? 'yes' : 'no'} summary=${prospect.summary ?? '—'}`,
    );
  });
};

run().catch((error) => {
  console.error(`sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  process.exitCode = 1;
});
