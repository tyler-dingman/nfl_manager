import { create } from 'zustand';

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

const teams: Team[] = [
  {
    id: 'phi',
    name: 'Philadelphia Eagles',
    abbr: 'PHI',
    logo_url: 'https://a.espncdn.com/i/teamlogos/nfl/500/phi.png',
    color_primary: '#004C54',
    color_secondary: '#A5ACAF',
  },
  {
    id: 'kc',
    name: 'Kansas City Chiefs',
    abbr: 'KC',
    logo_url: 'https://a.espncdn.com/i/teamlogos/nfl/500/kc.png',
    color_primary: '#E31837',
    color_secondary: '#FFB81C',
  },
  {
    id: 'sf',
    name: 'San Francisco 49ers',
    abbr: 'SF',
    logo_url: 'https://a.espncdn.com/i/teamlogos/nfl/500/sf.png',
    color_primary: '#AA0000',
    color_secondary: '#B3995D',
  },
];

export const useTeamStore = create<TeamState>((set) => ({
  teams,
  selectedTeamId: teams[0]?.id ?? 'phi',
  setSelectedTeamId: (teamId) => set({ selectedTeamId: teamId }),
}));
