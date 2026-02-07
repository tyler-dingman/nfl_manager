import { create } from 'zustand';

import { TEAM_LIST } from '@/data/teams';

export type Team = {
  id: string;
  name: string;
  abbr: string;
  logo_url: string;
  color_primary: string;
  color_secondary: string;
};

type TeamState = {
  teams: Team[];
  selectedTeamId: string;
  setSelectedTeamId: (teamId: string) => void;
};

const teams: Team[] = TEAM_LIST.map((team) => ({
  id: team.id,
  name: team.name,
  abbr: team.abbr,
  logo_url: team.logoUrl,
  color_primary: team.colors[0],
  color_secondary: team.colors[1],
}));

export const useTeamStore = create<TeamState>((set) => ({
  teams,
  selectedTeamId: teams[0]?.id ?? '',
  setSelectedTeamId: (teamId) => set({ selectedTeamId: teamId }),
}));
