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

const logoUrlFor = (abbr: string) =>
  `https://static.nfl.com/static/content/public/static/wildcat/assets/img/logos/teams/${abbr}.svg`;

const teams: Team[] = [
  {
    id: 'ARI',
    name: 'Arizona Cardinals',
    abbr: 'ARI',
    logo_url: logoUrlFor('ARI'),
    color_primary: '#97233F',
    color_secondary: '#000000',
  },
  {
    id: 'ATL',
    name: 'Atlanta Falcons',
    abbr: 'ATL',
    logo_url: logoUrlFor('ATL'),
    color_primary: '#A71930',
    color_secondary: '#000000',
  },
  {
    id: 'BAL',
    name: 'Baltimore Ravens',
    abbr: 'BAL',
    logo_url: logoUrlFor('BAL'),
    color_primary: '#241773',
    color_secondary: '#9E7C0C',
  },
  {
    id: 'BUF',
    name: 'Buffalo Bills',
    abbr: 'BUF',
    logo_url: logoUrlFor('BUF'),
    color_primary: '#00338D',
    color_secondary: '#C60C30',
  },
  {
    id: 'CAR',
    name: 'Carolina Panthers',
    abbr: 'CAR',
    logo_url: logoUrlFor('CAR'),
    color_primary: '#0085CA',
    color_secondary: '#101820',
  },
  {
    id: 'CHI',
    name: 'Chicago Bears',
    abbr: 'CHI',
    logo_url: logoUrlFor('CHI'),
    color_primary: '#0B162A',
    color_secondary: '#C83803',
  },
  {
    id: 'CIN',
    name: 'Cincinnati Bengals',
    abbr: 'CIN',
    logo_url: logoUrlFor('CIN'),
    color_primary: '#FB4F14',
    color_secondary: '#000000',
  },
  {
    id: 'CLE',
    name: 'Cleveland Browns',
    abbr: 'CLE',
    logo_url: logoUrlFor('CLE'),
    color_primary: '#311D00',
    color_secondary: '#FF3C00',
  },
  {
    id: 'DAL',
    name: 'Dallas Cowboys',
    abbr: 'DAL',
    logo_url: logoUrlFor('DAL'),
    color_primary: '#003594',
    color_secondary: '#869397',
  },
  {
    id: 'DEN',
    name: 'Denver Broncos',
    abbr: 'DEN',
    logo_url: logoUrlFor('DEN'),
    color_primary: '#FB4F14',
    color_secondary: '#002244',
  },
  {
    id: 'DET',
    name: 'Detroit Lions',
    abbr: 'DET',
    logo_url: logoUrlFor('DET'),
    color_primary: '#0076B6',
    color_secondary: '#B0B7BC',
  },
  {
    id: 'GB',
    name: 'Green Bay Packers',
    abbr: 'GB',
    logo_url: logoUrlFor('GB'),
    color_primary: '#203731',
    color_secondary: '#FFB612',
  },
  {
    id: 'HOU',
    name: 'Houston Texans',
    abbr: 'HOU',
    logo_url: logoUrlFor('HOU'),
    color_primary: '#03202F',
    color_secondary: '#A71930',
  },
  {
    id: 'IND',
    name: 'Indianapolis Colts',
    abbr: 'IND',
    logo_url: logoUrlFor('IND'),
    color_primary: '#002C5F',
    color_secondary: '#A2AAAD',
  },
  {
    id: 'JAX',
    name: 'Jacksonville Jaguars',
    abbr: 'JAX',
    logo_url: logoUrlFor('JAX'),
    color_primary: '#006778',
    color_secondary: '#D7A22A',
  },
  {
    id: 'KC',
    name: 'Kansas City Chiefs',
    abbr: 'KC',
    logo_url: logoUrlFor('KC'),
    color_primary: '#E31837',
    color_secondary: '#FFB81C',
  },
  {
    id: 'LV',
    name: 'Las Vegas Raiders',
    abbr: 'LV',
    logo_url: logoUrlFor('LV'),
    color_primary: '#000000',
    color_secondary: '#A5ACAF',
  },
  {
    id: 'LAC',
    name: 'Los Angeles Chargers',
    abbr: 'LAC',
    logo_url: logoUrlFor('LAC'),
    color_primary: '#0080C6',
    color_secondary: '#FFC20E',
  },
  {
    id: 'LAR',
    name: 'Los Angeles Rams',
    abbr: 'LAR',
    logo_url: logoUrlFor('LAR'),
    color_primary: '#003594',
    color_secondary: '#FFA300',
  },
  {
    id: 'MIA',
    name: 'Miami Dolphins',
    abbr: 'MIA',
    logo_url: logoUrlFor('MIA'),
    color_primary: '#008E97',
    color_secondary: '#FC4C02',
  },
  {
    id: 'MIN',
    name: 'Minnesota Vikings',
    abbr: 'MIN',
    logo_url: logoUrlFor('MIN'),
    color_primary: '#4F2683',
    color_secondary: '#FFC62F',
  },
  {
    id: 'NE',
    name: 'New England Patriots',
    abbr: 'NE',
    logo_url: logoUrlFor('NE'),
    color_primary: '#002244',
    color_secondary: '#C60C30',
  },
  {
    id: 'NO',
    name: 'New Orleans Saints',
    abbr: 'NO',
    logo_url: logoUrlFor('NO'),
    color_primary: '#D3BC8D',
    color_secondary: '#101820',
  },
  {
    id: 'NYG',
    name: 'New York Giants',
    abbr: 'NYG',
    logo_url: logoUrlFor('NYG'),
    color_primary: '#0B2265',
    color_secondary: '#A71930',
  },
  {
    id: 'NYJ',
    name: 'New York Jets',
    abbr: 'NYJ',
    logo_url: logoUrlFor('NYJ'),
    color_primary: '#125740',
    color_secondary: '#000000',
  },
  {
    id: 'PHI',
    name: 'Philadelphia Eagles',
    abbr: 'PHI',
    logo_url: logoUrlFor('PHI'),
    color_primary: '#004C54',
    color_secondary: '#A5ACAF',
  },
  {
    id: 'PIT',
    name: 'Pittsburgh Steelers',
    abbr: 'PIT',
    logo_url: logoUrlFor('PIT'),
    color_primary: '#FFB612',
    color_secondary: '#101820',
  },
  {
    id: 'SEA',
    name: 'Seattle Seahawks',
    abbr: 'SEA',
    logo_url: logoUrlFor('SEA'),
    color_primary: '#002244',
    color_secondary: '#69BE28',
  },
  {
    id: 'SF',
    name: 'San Francisco 49ers',
    abbr: 'SF',
    logo_url: logoUrlFor('SF'),
    color_primary: '#AA0000',
    color_secondary: '#B3995D',
  },
  {
    id: 'TB',
    name: 'Tampa Bay Buccaneers',
    abbr: 'TB',
    logo_url: logoUrlFor('TB'),
    color_primary: '#D50A0A',
    color_secondary: '#34302B',
  },
  {
    id: 'TEN',
    name: 'Tennessee Titans',
    abbr: 'TEN',
    logo_url: logoUrlFor('TEN'),
    color_primary: '#0C2340',
    color_secondary: '#4B92DB',
  },
  {
    id: 'WAS',
    name: 'Washington Commanders',
    abbr: 'WAS',
    logo_url: logoUrlFor('WAS'),
    color_primary: '#5A1414',
    color_secondary: '#FFB612',
  },
];

export const useTeamStore = create<TeamState>((set) => ({
  teams,
  selectedTeamId: teams[0]?.id ?? 'ARI',
  setSelectedTeamId: (teamId) => set({ selectedTeamId: teamId.toUpperCase() }),
}));
