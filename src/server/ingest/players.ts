import { fetchRoster, fetchTeams } from '@/server/data-sources/espn';
import { fetchTeamStats } from '@/server/data-sources/espn-stats';
import {
  buildMaddenPlayerKey,
  fetchMaddenRatings,
  type MaddenRatingRecord,
} from '@/server/data-sources/madden-ratings';
import type { UnifiedPlayer, UnifiedTeam } from '@/server/data/nfl-data';
import { normalizeName, normalizePlayerName, normalizeTeamName } from './normalize';
import { NFL_TEAM_SEED, TEAM_ALIAS_TO_ABBR } from './teams';

export type PlayerSyncResult = {
  teams: UnifiedTeam[];
  players: UnifiedPlayer[];
  insertedPlayers: number;
  updatedPlayers: number;
  rosterErrors: Array<{ teamId: string; reason: string }>;
  maddenReport: {
    fetchedRows: number;
    matchedPlayers: number;
    unmatchedRows: number;
    sampleBlends: Array<{
      name: string;
      teamAbbr: string;
      baselineRating: number;
      maddenRating: number | null;
      rating: number;
    }>;
  };
};

const resolveTeamAbbr = (teamName: string, fallbackAbbr?: string) => {
  const normalized = normalizeTeamName(teamName);
  const fromAlias = TEAM_ALIAS_TO_ABBR[normalized];
  if (fromAlias) return fromAlias;
  if (fallbackAbbr) return fallbackAbbr;
  const fromSeed = NFL_TEAM_SEED.find((team) => team.name === teamName);
  return fromSeed?.abbreviation;
};

const normalizeComparableName = (value: string) =>
  normalizePlayerName(value)
    .replace(/\b(jr|sr|ii|iii|iv|v)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const isNonEmptyStats = (stats: UnifiedPlayer['stats'] | undefined | null) =>
  Boolean(stats && Object.keys(stats).length > 0);

const normalizePositionBucket = (position: string): string => {
  const normalized = position.trim().toUpperCase();

  if (['LT', 'RT', 'T', 'OT'].includes(normalized)) return 'OT';
  if (['LG', 'RG', 'G'].includes(normalized)) return 'G';
  if (['C'].includes(normalized)) return 'C';

  if (['HB', 'FB', 'RB'].includes(normalized)) return 'RB';
  if (['WR'].includes(normalized)) return 'WR';
  if (['TE'].includes(normalized)) return 'TE';
  if (['QB'].includes(normalized)) return 'QB';

  if (['LE', 'RE', 'DE', 'EDGE', 'LEDG', 'REDG'].includes(normalized)) return 'DE';
  if (['DT', 'NT', 'DL'].includes(normalized)) return 'DT';

  if (['LOLB', 'ROLB', 'ILB', 'MLB', 'LB', 'OLB', 'MIKE', 'SAM', 'WILL'].includes(normalized)) {
    return 'LB';
  }

  if (['SS', 'FS', 'S'].includes(normalized)) return 'S';
  if (['CB'].includes(normalized)) return 'CB';

  if (['K', 'P'].includes(normalized)) return normalized;

  return normalized;
};

const getPositionCandidates = (position: string): string[] => {
  const bucket = normalizePositionBucket(position);

  switch (bucket) {
    case 'OT':
      return ['OT', 'LT', 'RT', 'T', 'OL'];
    case 'G':
      return ['G', 'LG', 'RG', 'OL'];
    case 'C':
      return ['C', 'OL'];
    case 'RB':
      return ['RB', 'HB', 'FB'];
    case 'DE':
      return ['DE', 'LE', 'RE', 'EDGE', 'LEDG', 'REDG'];
    case 'DT':
      return ['DT', 'NT', 'DL'];
    case 'LB':
      return ['LB', 'OLB', 'ILB', 'MLB', 'LOLB', 'ROLB', 'MIKE', 'SAM', 'WILL'];
    case 'S':
      return ['S', 'SS', 'FS'];
    default:
      return [bucket];
  }
};

const buildMaddenLookup = (rows: MaddenRatingRecord[]) => {
  const byNameTeamAndPosition = new Map<string, number>();
  const byNameAndTeam = new Map<string, number>();
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

    const normalizedName = normalizeComparableName(keyParts.normalizedName);
    const positionBucket = normalizePositionBucket(keyParts.position);

    const teamNameKey = `${normalizedName}:${keyParts.teamAbbr}`;
    if (!byNameAndTeam.has(teamNameKey)) {
      byNameAndTeam.set(teamNameKey, row.overallRating);
    }

    const positionalKey = `${teamNameKey}:${positionBucket}`;
    if (!byNameTeamAndPosition.has(positionalKey)) {
      byNameTeamAndPosition.set(positionalKey, row.overallRating);
    }

    byNameOnlyCounts.set(normalizedName, (byNameOnlyCounts.get(normalizedName) ?? 0) + 1);
    if (!byNameOnly.has(normalizedName)) {
      byNameOnly.set(normalizedName, row.overallRating);
    }
  });

  return { byNameTeamAndPosition, byNameAndTeam, byNameOnly, byNameOnlyCounts };
};

export const syncPlayers = async (
  existingPlayers: UnifiedPlayer[] = [],
): Promise<PlayerSyncResult> => {
  const rosterErrors: Array<{ teamId: string; reason: string }> = [];

  const teamRecords = await fetchTeams();
  const teamsByAbbr = new Map(NFL_TEAM_SEED.map((team) => [team.abbreviation, team]));

  const teams: UnifiedTeam[] = NFL_TEAM_SEED.map((seed) => ({
    id: seed.abbreviation,
    abbr: seed.abbreviation,
    name: seed.name,
    conference: seed.conference,
    division: seed.division,
  }));

  const existingByKey = new Map(
    existingPlayers.map((player) => [`${player.teamAbbr}:${player.id}`, player]),
  );
  const nextPlayers = new Map<string, UnifiedPlayer>();

  for (const team of teamRecords) {
    const teamAbbr = resolveTeamAbbr(team.name, team.abbreviation);
    if (!teamAbbr || !teamsByAbbr.has(teamAbbr)) {
      rosterErrors.push({ teamId: team.id, reason: `Could not map ESPN team ${team.name}` });
      continue;
    }

    try {
      const roster = await fetchRoster(team.id);

      const teamStats = await fetchTeamStats(
        team.id,
        roster.map((player) => ({
          id: player.id,
          name: player.name,
          teamAbbr,
          position: player.position,
        })),
      );

      const statsByPlayerId = new Map(
        teamStats
          .filter((entry) => entry.playerId)
          .map((entry) => [entry.playerId as string, entry.stats]),
      );

      const statsByName = new Map(
        teamStats.map((entry) => [normalizeComparableName(entry.playerName), entry.stats]),
      );

      let playersWithStats = 0;

      for (const player of roster) {
        const key = `${teamAbbr}:${player.id}`;
        const statsFromId = statsByPlayerId.get(player.id);
        const statsFromName = statsByName.get(normalizeComparableName(player.name));
        const playerStats = statsFromId ?? statsFromName ?? {};

        if (isNonEmptyStats(playerStats)) {
          playersWithStats += 1;
        }

        nextPlayers.set(key, {
          id: player.id,
          teamAbbr,
          name: player.name,
          position: player.position,
          baselineRating: 75,
          maddenRating: null,
          rating: 75,
          age: player.age,
          height: player.height,
          weight: player.weight,
          headshotUrl: player.headshotUrl,
          stats: playerStats,
        });
      }

      console.log(
        `[sync:players] ${teamAbbr} fetched ${teamStats.length} player stat rows; ${playersWithStats}/${roster.length} roster players received non-empty stats`,
      );
    } catch (error) {
      rosterErrors.push({
        teamId: team.id,
        reason: error instanceof Error ? error.message : 'Unknown roster/stats error',
      });
    }
  }

  const mergedPlayerStatsCount = Array.from(nextPlayers.values()).filter((player) =>
    isNonEmptyStats(player.stats),
  ).length;
  console.log(`[sync:players] total merged roster player stats records=${mergedPlayerStatsCount}`);

  const samplePlayers = ['Patrick Mahomes', 'Travis Kelce', 'Chris Jones'];
  samplePlayers.forEach((playerName) => {
    const sample = Array.from(nextPlayers.values()).find(
      (player) => normalizeComparableName(player.name) === normalizeComparableName(playerName),
    );
    const stats = sample?.stats ?? null;
    const hasStats = isNonEmptyStats(stats ?? undefined);
    console.log(`[sync:players] sample stats ${playerName} nonEmpty=${hasStats}:`, stats);
  });

  const maddenRows = await fetchMaddenRatings().catch((error) => {
    rosterErrors.push({
      teamId: 'MADDEN',
      reason: error instanceof Error ? error.message : 'Unknown Madden fetch error',
    });
    return [] satisfies MaddenRatingRecord[];
  });

  const lookup = buildMaddenLookup(maddenRows);
  let matchedPlayers = 0;

  for (const [key, player] of nextPlayers.entries()) {
    const normalizedName = normalizeComparableName(player.name);
    const teamKey = `${normalizedName}:${player.teamAbbr}`;

    let maddenRating: number | undefined;

    for (const positionCandidate of getPositionCandidates(player.position)) {
      const positionalKey = `${teamKey}:${normalizePositionBucket(positionCandidate)}`;
      const found = lookup.byNameTeamAndPosition.get(positionalKey);
      if (found !== undefined) {
        maddenRating = found;
        break;
      }
    }

    if (maddenRating === undefined) {
      maddenRating = lookup.byNameAndTeam.get(teamKey);
    }

    if (maddenRating === undefined) {
      const count = lookup.byNameOnlyCounts.get(normalizedName) ?? 0;
      if (count === 1) {
        maddenRating = lookup.byNameOnly.get(normalizedName);
      }
    }

    nextPlayers.set(key, {
      ...player,
      maddenRating: maddenRating ?? null,
    });

    if (maddenRating !== undefined) {
      matchedPlayers += 1;
    }
  }

  let insertedPlayers = 0;
  let updatedPlayers = 0;
  for (const [key, player] of nextPlayers.entries()) {
    const existing = existingByKey.get(key);
    if (!existing) {
      insertedPlayers += 1;
    } else if (
      normalizeName(existing.name) !== normalizeName(player.name) ||
      existing.position !== player.position ||
      existing.age !== player.age ||
      existing.height !== player.height ||
      existing.weight !== player.weight ||
      existing.headshotUrl !== player.headshotUrl ||
      existing.baselineRating !== player.baselineRating ||
      existing.maddenRating !== player.maddenRating ||
      existing.rating !== player.rating ||
      JSON.stringify(existing.stats ?? {}) !== JSON.stringify(player.stats ?? {})
    ) {
      updatedPlayers += 1;
    }
  }

  const sampleBlends = Array.from(nextPlayers.values())
    .filter((player) => player.maddenRating !== null)
    .slice(0, 5)
    .map((player) => ({
      name: player.name,
      teamAbbr: player.teamAbbr,
      baselineRating: player.baselineRating,
      maddenRating: player.maddenRating,
      rating: player.rating,
    }));

  return {
    teams,
    players: Array.from(nextPlayers.values()),
    insertedPlayers,
    updatedPlayers,
    rosterErrors,
    maddenReport: {
      fetchedRows: maddenRows.length,
      matchedPlayers,
      unmatchedRows: Math.max(0, maddenRows.length - matchedPlayers),
      sampleBlends,
    },
  };
};
