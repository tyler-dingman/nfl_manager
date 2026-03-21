export type TeamDTO = {
  id: string;
  abbr: string;
  name: string;
  logoUrl: string;
  colors: string[];
  teamOverviewRaw?: number;
  offenseOverviewRaw?: number;
  defenseOverviewRaw?: number;
  specialTeamsOverviewRaw?: number;
  teamOverview: number;
  offenseOverview: number;
  defenseOverview: number;
  specialTeamsOverview: number;
  teamOverviewGrade: string;
  teamNeeds: string[];
  allTeamNeeds?: string[];
};
