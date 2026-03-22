import type { TeamDTO } from '@/types/team';

import { TEAM_LIST } from '@/data/teams';
import { NFL_LEAGUE_DATA } from '@/server/data/nfl-data';

export const logoUrlFor = (abbr: string) =>
  `https://static.www.nfl.com/t_q-best/league/api/clubs/logos/${abbr}.svg`;

const FALLBACK_TEAM_OVERVIEW = {
  teamOverview: 75,
  offenseOverview: 75,
  defenseOverview: 75,
  specialTeamsOverview: 75,
  teamOverviewGrade: 'B-',
  teamNeeds: ['QB', 'OT', 'CB'],
  allTeamNeeds: ['QB', 'OT', 'CB'],
};

export const listTeams = (): TeamDTO[] =>
  TEAM_LIST.map((team) => {
    const generatedTeam = NFL_LEAGUE_DATA.teams.find((entry) => entry.abbr === team.abbr);

    return {
      id: team.id,
      abbr: team.abbr,
      name: generatedTeam?.name ?? team.name,
      logoUrl: team.logoUrl,
      colors: team.colors,
      teamOverviewRaw: generatedTeam?.teamOverviewRaw,
      offenseOverviewRaw: generatedTeam?.offenseOverviewRaw,
      defenseOverviewRaw: generatedTeam?.defenseOverviewRaw,
      specialTeamsOverviewRaw: generatedTeam?.specialTeamsOverviewRaw,
      teamOverview: generatedTeam?.teamOverview ?? FALLBACK_TEAM_OVERVIEW.teamOverview,
      offenseOverview: generatedTeam?.offenseOverview ?? FALLBACK_TEAM_OVERVIEW.offenseOverview,
      defenseOverview: generatedTeam?.defenseOverview ?? FALLBACK_TEAM_OVERVIEW.defenseOverview,
      specialTeamsOverview:
        generatedTeam?.specialTeamsOverview ?? FALLBACK_TEAM_OVERVIEW.specialTeamsOverview,
      teamOverviewGrade:
        generatedTeam?.teamOverviewGrade ?? FALLBACK_TEAM_OVERVIEW.teamOverviewGrade,
      teamNeeds: generatedTeam?.teamNeeds ?? FALLBACK_TEAM_OVERVIEW.teamNeeds,
      allTeamNeeds:
        generatedTeam?.allTeamNeeds ??
        generatedTeam?.teamNeeds ??
        FALLBACK_TEAM_OVERVIEW.allTeamNeeds,
    };
  });
