import { fetchRoster, fetchTeams } from '@/server/data-sources/espn';
import {
  buildMaddenPlayerKey,
  fetchMaddenRatings,
  normalizeFootballPosition,
  type MaddenRatingRecord,
} from '@/server/data-sources/madden-ratings';
import type { UnifiedPlayer, UnifiedTeam } from '@/server/data/nfl-data';
import { blendPlayerRating, generateBaselinePlayerRating } from './ratings';
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

const DEBUG_MADDEN_PLAYERS = new Set(['patrick mahomes', 'travis kelce', 'chris jones']);

const logMaddenDebugForTargetPlayers = (rows: MaddenRatingRecord[]) => {
  rows.forEach((row) => {
    const normalizedName = normalizePlayerName(row.playerName);
    if (!DEBUG_MADDEN_PLAYERS.has(normalizedName)) {
      return;
    }

    const key = buildMaddenPlayerKey({
      playerName: row.playerName,
      team: row.team,
      position: row.position,
    });

    console.log(
      `[madden][debug][row] rawName="${row.playerName}" normalizedName="${key.normalizedName}" rawTeam="${row.team}" teamAbbr="${key.teamAbbr ?? 'unknown'}" rawPosition="${row.position}" normalizedPosition="${key.position}" finalKey="${key.normalizedName}:${key.teamAbbr ?? 'unknown'}:${key.position}"`,
    );
  });
};

const logSyncedDebugForTargetPlayers = (players: Map<string, UnifiedPlayer>) => {
  players.forEach((player) => {
    const normalizedName = normalizePlayerName(player.name);
    if (!DEBUG_MADDEN_PLAYERS.has(normalizedName)) {
      return;
    }

    const normalizedPosition = normalizeFootballPosition(player.position);
    const finalKey = `${normalizedName}:${player.teamAbbr}:${normalizedPosition}`;

    console.log(
      `[madden][debug][sync] rawName="${player.name}" normalizedName="${normalizedName}" rawTeam="${player.teamAbbr}" teamAbbr="${player.teamAbbr}" rawPosition="${player.position}" normalizedPosition="${normalizedPosition}" finalKey="${finalKey}"`,
    );
  });
};

const getPositionCandidates = (position: string): string[] => {
  const normalized = position.trim().toUpperCase();
  const bucket = normalizeFootballPosition(normalized);

  if (bucket === 'C') return ['C', 'IOL'];
  return [bucket, normalized];
};

const buildMaddenLookup = (rows: MaddenRatingRecord[]) => {
  const byNameTeamAndPosition = new Map<string, number>();
  const byNameAndTeam = new Map<string, number>();

  rows.forEach((row) => {
    const keyParts = buildMaddenPlayerKey({
      playerName: row.playerName,
      team: row.team,
      position: row.position,
    });

    if (!keyParts.teamAbbr || !keyParts.normalizedName) {
      return;
    }

    const teamNameKey = `${keyParts.normalizedName}:${keyParts.teamAbbr}`;
    if (!byNameAndTeam.has(teamNameKey)) {
      byNameAndTeam.set(teamNameKey, row.overallRating);
    }

    const positionalKey = `${teamNameKey}:${keyParts.position}`;
    if (!byNameTeamAndPosition.has(positionalKey)) {
      byNameTeamAndPosition.set(positionalKey, row.overallRating);
    }
  });

  return { byNameTeamAndPosition, byNameAndTeam };
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
      for (const player of roster) {
        const key = `${teamAbbr}:${player.id}`;
        const baselineRating = generateBaselinePlayerRating();
        nextPlayers.set(key, {
          id: player.id,
          teamAbbr,
          name: player.name,
          position: player.position,
          baselineRating,
          maddenRating: null,
          rating: baselineRating,
          age: player.age,
          height: player.height,
          weight: player.weight,
          headshotUrl: player.headshotUrl,
        });
      }
    } catch (error) {
      rosterErrors.push({
        teamId: team.id,
        reason: error instanceof Error ? error.message : 'Unknown roster error',
      });
    }
  }

  const maddenRows = await fetchMaddenRatings().catch((error) => {
    rosterErrors.push({
      teamId: 'MADDEN',
      reason: error instanceof Error ? error.message : 'Unknown Madden fetch error',
    });
    return [] satisfies MaddenRatingRecord[];
  });

  const lookup = buildMaddenLookup(maddenRows);
  logMaddenDebugForTargetPlayers(maddenRows);
  logSyncedDebugForTargetPlayers(nextPlayers);
  let matchedPlayers = 0;

  for (const [key, player] of nextPlayers.entries()) {
    const normalizedName = normalizePlayerName(player.name);
    const teamKey = `${normalizedName}:${player.teamAbbr}`;

    let maddenRating: number | undefined;
    for (const positionCandidate of getPositionCandidates(player.position)) {
      const positionalKey = `${teamKey}:${positionCandidate}`;
      const found = lookup.byNameTeamAndPosition.get(positionalKey);
      if (found !== undefined) {
        maddenRating = found;
        break;
      }
    }

    if (maddenRating === undefined) {
      maddenRating = lookup.byNameAndTeam.get(teamKey);
    }

    const rating = blendPlayerRating(player.baselineRating, maddenRating ?? null);

    nextPlayers.set(key, {
      ...player,
      maddenRating: maddenRating ?? null,
      rating,
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
      existing.rating !== player.rating
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
