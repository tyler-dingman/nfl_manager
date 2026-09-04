import { create } from 'zustand';

import { TEAM_LIST } from '@/data/teams';

export type Team = {
  id: string;
  name: string;
  city?: string;
  abbr: string;
  logo_url: string;
  color_primary: string;
  color_secondary: string;
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

type TeamState = {
  teams: Team[];
  selectedTeamId: string;
  setTeams: (teams: Team[]) => void;
  setSelectedTeamId: (teamId: string) => void;
};

const teams: Team[] = TEAM_LIST.map((team) => ({
  id: team.id,
  name: team.name,
  city: team.city,
  abbr: team.abbr,
  logo_url: team.logoUrl,
  color_primary: team.colors[0],
  color_secondary: team.colors[1],
  teamOverviewRaw: undefined,
  offenseOverviewRaw: undefined,
  defenseOverviewRaw: undefined,
  specialTeamsOverviewRaw: undefined,
  teamOverview: 75,
  offenseOverview: 75,
  defenseOverview: 75,
  specialTeamsOverview: 75,
  teamOverviewGrade: 'B-',
  teamNeeds: ['QB', 'OT', 'CB'],
  allTeamNeeds: ['QB', 'OT', 'CB'],
}));

export const useTeamStore = create<TeamState>((set) => ({
  teams,
  selectedTeamId: teams[0]?.id ?? '',
  setTeams: (nextTeams) =>
    set((state) => ({
      teams: nextTeams,
      selectedTeamId:
        nextTeams.find((team) => team.id === state.selectedTeamId)?.id ?? nextTeams[0]?.id ?? '',
    })),
  setSelectedTeamId: (teamId) => set({ selectedTeamId: teamId }),
}));
