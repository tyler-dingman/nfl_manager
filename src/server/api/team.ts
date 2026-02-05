import type { TeamDTO } from '@/types/team';

const logoUrlFor = (abbr: string) =>
  `https://a.espncdn.com/i/teamlogos/nfl/500/${abbr.toLowerCase()}.png`;

const TEAMS: TeamDTO[] = [
  {
    abbr: 'ARI',
    name: 'Arizona Cardinals',
    logoUrl: logoUrlFor('ARI'),
    colors: ['#97233F', '#000000'],
  },
  {
    abbr: 'ATL',
    name: 'Atlanta Falcons',
    logoUrl: logoUrlFor('ATL'),
    colors: ['#A71930', '#000000'],
  },
  {
    abbr: 'BAL',
    name: 'Baltimore Ravens',
    logoUrl: logoUrlFor('BAL'),
    colors: ['#241773', '#9E7C0C'],
  },
  {
    abbr: 'BUF',
    name: 'Buffalo Bills',
    logoUrl: logoUrlFor('BUF'),
    colors: ['#00338D', '#C60C30'],
  },
  {
    abbr: 'CAR',
    name: 'Carolina Panthers',
    logoUrl: logoUrlFor('CAR'),
    colors: ['#0085CA', '#101820'],
  },
  {
    abbr: 'CHI',
    name: 'Chicago Bears',
    logoUrl: logoUrlFor('CHI'),
    colors: ['#0B162A', '#C83803'],
  },
  {
    abbr: 'CIN',
    name: 'Cincinnati Bengals',
    logoUrl: logoUrlFor('CIN'),
    colors: ['#FB4F14', '#000000'],
  },
  {
    abbr: 'CLE',
    name: 'Cleveland Browns',
    logoUrl: logoUrlFor('CLE'),
    colors: ['#311D00', '#FF3C00'],
  },
  {
    abbr: 'DAL',
    name: 'Dallas Cowboys',
    logoUrl: logoUrlFor('DAL'),
    colors: ['#003594', '#869397'],
  },
  {
    abbr: 'DEN',
    name: 'Denver Broncos',
    logoUrl: logoUrlFor('DEN'),
    colors: ['#FB4F14', '#002244'],
  },
  {
    abbr: 'DET',
    name: 'Detroit Lions',
    logoUrl: logoUrlFor('DET'),
    colors: ['#0076B6', '#B0B7BC'],
  },
  {
    abbr: 'GB',
    name: 'Green Bay Packers',
    logoUrl: logoUrlFor('GB'),
    colors: ['#203731', '#FFB612'],
  },
  {
    abbr: 'HOU',
    name: 'Houston Texans',
    logoUrl: logoUrlFor('HOU'),
    colors: ['#03202F', '#A71930'],
  },
  {
    abbr: 'IND',
    name: 'Indianapolis Colts',
    logoUrl: logoUrlFor('IND'),
    colors: ['#002C5F', '#A2AAAD'],
  },
  {
    abbr: 'JAX',
    name: 'Jacksonville Jaguars',
    logoUrl: logoUrlFor('JAX'),
    colors: ['#006778', '#D7A22A'],
  },
  {
    abbr: 'KC',
    name: 'Kansas City Chiefs',
    logoUrl: logoUrlFor('KC'),
    colors: ['#E31837', '#FFB81C'],
  },
  {
    abbr: 'LV',
    name: 'Las Vegas Raiders',
    logoUrl: logoUrlFor('LV'),
    colors: ['#000000', '#A5ACAF'],
  },
  {
    abbr: 'LAC',
    name: 'Los Angeles Chargers',
    logoUrl: logoUrlFor('LAC'),
    colors: ['#0080C6', '#FFC20E'],
  },
  {
    abbr: 'LAR',
    name: 'Los Angeles Rams',
    logoUrl: logoUrlFor('LAR'),
    colors: ['#003594', '#FFA300'],
  },
  {
    abbr: 'MIA',
    name: 'Miami Dolphins',
    logoUrl: logoUrlFor('MIA'),
    colors: ['#008E97', '#FC4C02'],
  },
  {
    abbr: 'MIN',
    name: 'Minnesota Vikings',
    logoUrl: logoUrlFor('MIN'),
    colors: ['#4F2683', '#FFC62F'],
  },
  {
    abbr: 'NE',
    name: 'New England Patriots',
    logoUrl: logoUrlFor('NE'),
    colors: ['#002244', '#C60C30'],
  },
  {
    abbr: 'NO',
    name: 'New Orleans Saints',
    logoUrl: logoUrlFor('NO'),
    colors: ['#D3BC8D', '#101820'],
  },
  {
    abbr: 'NYG',
    name: 'New York Giants',
    logoUrl: logoUrlFor('NYG'),
    colors: ['#0B2265', '#A71930'],
  },
  {
    abbr: 'NYJ',
    name: 'New York Jets',
    logoUrl: logoUrlFor('NYJ'),
    colors: ['#125740', '#000000'],
  },
  {
    abbr: 'PHI',
    name: 'Philadelphia Eagles',
    logoUrl: logoUrlFor('PHI'),
    colors: ['#004C54', '#A5ACAF'],
  },
  {
    abbr: 'PIT',
    name: 'Pittsburgh Steelers',
    logoUrl: logoUrlFor('PIT'),
    colors: ['#FFB612', '#101820'],
  },
  {
    abbr: 'SEA',
    name: 'Seattle Seahawks',
    logoUrl: logoUrlFor('SEA'),
    colors: ['#002244', '#69BE28'],
  },
  {
    abbr: 'SF',
    name: 'San Francisco 49ers',
    logoUrl: logoUrlFor('SF'),
    colors: ['#AA0000', '#B3995D'],
  },
  {
    abbr: 'TB',
    name: 'Tampa Bay Buccaneers',
    logoUrl: logoUrlFor('TB'),
    colors: ['#D50A0A', '#34302B'],
  },
  {
    abbr: 'TEN',
    name: 'Tennessee Titans',
    logoUrl: logoUrlFor('TEN'),
    colors: ['#0C2340', '#4B92DB'],
  },
  {
    abbr: 'WAS',
    name: 'Washington Commanders',
    logoUrl: logoUrlFor('WAS'),
    colors: ['#5A1414', '#FFB612'],
  },
];

export const listTeams = (): TeamDTO[] => TEAMS;
