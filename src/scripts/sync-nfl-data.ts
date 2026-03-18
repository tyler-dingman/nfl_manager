import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type {
  IngestedLeagueData,
  UnifiedContract,
  UnifiedFreeAgent,
  UnifiedPlayer,
} from '@/server/data/nfl-data';
import { syncCap } from '@/server/ingest/cap';
import { syncContracts } from '@/server/ingest/contracts';
import { syncPlayers } from '@/server/ingest/players';
import {
  buildRosterMatchedExpiringContracts,
  OFFSEASON_EXPIRING_SEASON_YEAR,
} from '@/server/logic/contract-expiration';

const DATA_FILE = path.join(process.cwd(), 'src/server/data/nfl-data.json');

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

const enrichFreeAgentsWithRatings = (
  freeAgents: UnifiedFreeAgent[],
  players: UnifiedPlayer[],
): UnifiedFreeAgent[] => {
  const playersById = new Map(players.map((player) => [player.id, player]));
  const playersByNormalizedName = new Map<string, UnifiedPlayer[]>();
  const playersByNormalizedNameAndPosition = new Map<string, UnifiedPlayer[]>();

  for (const player of players) {
    const normalizedName = normalizeFreeAgentName(player.name);
    const bucket = normalizePositionBucket(player.position);

    const nameBucket = playersByNormalizedName.get(normalizedName) ?? [];
    nameBucket.push(player);
    playersByNormalizedName.set(normalizedName, nameBucket);

    const namePositionKey = `${normalizedName}:${bucket}`;
    const positionBucketPlayers = playersByNormalizedNameAndPosition.get(namePositionKey) ?? [];
    positionBucketPlayers.push(player);
    playersByNormalizedNameAndPosition.set(namePositionKey, positionBucketPlayers);
  }

  return freeAgents.map((freeAgent) => {
    const directMatch = playersById.get(freeAgent.id) ?? null;
    const normalizedName = freeAgent.normalizedName || normalizeFreeAgentName(freeAgent.name);
    const positionBucket = normalizePositionBucket(freeAgent.position);
    const nameAndPositionMatches =
      playersByNormalizedNameAndPosition.get(`${normalizedName}:${positionBucket}`) ?? [];
    const uniqueNameAndPositionMatch =
      nameAndPositionMatches.length === 1 ? nameAndPositionMatches[0] : null;
    const nameMatches = playersByNormalizedName.get(normalizedName) ?? [];
    const uniqueNameMatch = nameMatches.length === 1 ? nameMatches[0] : null;
    const matchedPlayer = directMatch ?? uniqueNameAndPositionMatch ?? uniqueNameMatch;

    return {
      ...freeAgent,
      rating: matchedPlayer?.rating ?? freeAgent.rating ?? null,
    };
  });
};

const run = async () => {
  const now = new Date().toISOString();

  const playerSync = await syncPlayers();
  const capSync = await syncCap();
  const contractSync = await syncContracts(playerSync.teams, playerSync.players);
  const enrichedPlayers = buildRatedPlayers(playerSync.players, contractSync.contracts);
  const enrichedFreeAgents = enrichFreeAgentsWithRatings(contractSync.freeAgents, enrichedPlayers);

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
