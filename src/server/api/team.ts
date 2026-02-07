import type { TeamDTO } from '@/types/team';

import { TEAM_LIST } from '@/data/teams';

export const logoUrlFor = (abbr: string) =>
  `https://static.www.nfl.com/t_q-best/league/api/clubs/logos/${abbr}.svg`;

export const listTeams = (): TeamDTO[] =>
  TEAM_LIST.map((team) => ({
    abbr: team.abbr,
    name: team.name,
    logoUrl: team.logoUrl,
    colors: team.colors,
  }));
