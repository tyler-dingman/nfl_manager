import { NFL_TEAM_SEED } from '@/server/ingest/teams';
import { getTeamBrandTheme } from '@/lib/team-brand-themes';

export type TeamInfo = {
  id: string;
  abbr: string;
  name: string;
  colors: [string, string];
  logoUrl: string;
};

export const nflLogoUrl = (abbr: string) =>
  `https://static.www.nfl.com/t_q-best/league/api/clubs/logos/${abbr}.svg`;

export const TEAM_LIST: TeamInfo[] = NFL_TEAM_SEED.map((team) => ({
  id: team.abbreviation.toLowerCase(),
  abbr: team.abbreviation,
  name: team.name,
  colors: (() => {
    const theme = getTeamBrandTheme(team.abbreviation);
    return [theme.primary, theme.secondary] as [string, string];
  })(),
  logoUrl: nflLogoUrl(team.abbreviation),
}));
