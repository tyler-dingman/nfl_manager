import { fetchRoster, fetchTeams } from '@/server/data-sources/espn';
import { normalizeName, normalizeTeamName } from './normalize';
import { NFL_TEAM_SEED, TEAM_ALIAS_TO_ABBR } from './teams';
import type { IngestedPlayer, IngestedTeam } from '@/server/data/nfl-data';

export type PlayerSyncResult = {
  teams: IngestedTeam[];
  players: IngestedPlayer[];
  insertedPlayers: number;
  updatedPlayers: number;
  rosterErrors: Array<{ teamId: string; reason: string }>;
};

const resolveTeamAbbr = (teamName: string, fallbackAbbr?: string) => {
  const normalized = normalizeTeamName(teamName);
  const fromAlias = TEAM_ALIAS_TO_ABBR[normalized];
  if (fromAlias) return fromAlias;
  if (fallbackAbbr) return fallbackAbbr;
  const fromSeed = NFL_TEAM_SEED.find((team) => team.name === teamName);
  return fromSeed?.abbreviation;
};

export const syncPlayers = async (
  existingPlayers: IngestedPlayer[] = [],
): Promise<PlayerSyncResult> => {
  const rosterErrors: Array<{ teamId: string; reason: string }> = [];

  const teamRecords = await fetchTeams();
  const teamsByAbbr = new Map(NFL_TEAM_SEED.map((team) => [team.abbreviation, team]));

  const teams: IngestedTeam[] = NFL_TEAM_SEED.map((seed) => ({
    id: seed.abbreviation,
    abbreviation: seed.abbreviation,
    name: seed.name,
    city: seed.city,
    conference: seed.conference,
    division: seed.division,
    normalizedName: normalizeTeamName(seed.name),
  }));

  const existingByKey = new Map(
    existingPlayers.map((player) => [`${player.teamAbbr}:${player.id}`, player]),
  );
  const nextPlayers = new Map<string, IngestedPlayer>();

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
        nextPlayers.set(key, {
          id: player.id,
          teamAbbr,
          fullName: player.fullName,
          normalizedName: normalizeName(player.fullName),
          position: player.position,
          jerseyNumber: player.jerseyNumber,
        });
      }
    } catch (error) {
      rosterErrors.push({
        teamId: team.id,
        reason: error instanceof Error ? error.message : 'Unknown roster error',
      });
    }
  }

  let insertedPlayers = 0;
  let updatedPlayers = 0;
  for (const [key, player] of nextPlayers.entries()) {
    const existing = existingByKey.get(key);
    if (!existing) {
      insertedPlayers += 1;
    } else if (
      existing.fullName !== player.fullName ||
      existing.position !== player.position ||
      existing.jerseyNumber !== player.jerseyNumber
    ) {
      updatedPlayers += 1;
    }
  }

  return {
    teams,
    players: Array.from(nextPlayers.values()),
    insertedPlayers,
    updatedPlayers,
    rosterErrors,
  };
};
