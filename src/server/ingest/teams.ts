import { normalizeTeamName } from './normalize';
import type { UnifiedTeam } from '@/server/data/nfl-data';

export type CanonicalTeamSeed = {
  name: string;
  city: string;
  abbreviation: string;
  conference: 'AFC' | 'NFC';
  division: 'North' | 'South' | 'East' | 'West';
};

export const NFL_TEAM_SEED: CanonicalTeamSeed[] = [
  {
    name: 'Arizona Cardinals',
    city: 'Arizona',
    abbreviation: 'ARI',
    conference: 'NFC',
    division: 'West',
  },
  {
    name: 'Atlanta Falcons',
    city: 'Atlanta',
    abbreviation: 'ATL',
    conference: 'NFC',
    division: 'South',
  },
  {
    name: 'Baltimore Ravens',
    city: 'Baltimore',
    abbreviation: 'BAL',
    conference: 'AFC',
    division: 'North',
  },
  {
    name: 'Buffalo Bills',
    city: 'Buffalo',
    abbreviation: 'BUF',
    conference: 'AFC',
    division: 'East',
  },
  {
    name: 'Carolina Panthers',
    city: 'Carolina',
    abbreviation: 'CAR',
    conference: 'NFC',
    division: 'South',
  },
  {
    name: 'Chicago Bears',
    city: 'Chicago',
    abbreviation: 'CHI',
    conference: 'NFC',
    division: 'North',
  },
  {
    name: 'Cincinnati Bengals',
    city: 'Cincinnati',
    abbreviation: 'CIN',
    conference: 'AFC',
    division: 'North',
  },
  {
    name: 'Cleveland Browns',
    city: 'Cleveland',
    abbreviation: 'CLE',
    conference: 'AFC',
    division: 'North',
  },
  {
    name: 'Dallas Cowboys',
    city: 'Dallas',
    abbreviation: 'DAL',
    conference: 'NFC',
    division: 'East',
  },
  {
    name: 'Denver Broncos',
    city: 'Denver',
    abbreviation: 'DEN',
    conference: 'AFC',
    division: 'West',
  },
  {
    name: 'Detroit Lions',
    city: 'Detroit',
    abbreviation: 'DET',
    conference: 'NFC',
    division: 'North',
  },
  {
    name: 'Green Bay Packers',
    city: 'Green Bay',
    abbreviation: 'GB',
    conference: 'NFC',
    division: 'North',
  },
  {
    name: 'Houston Texans',
    city: 'Houston',
    abbreviation: 'HOU',
    conference: 'AFC',
    division: 'South',
  },
  {
    name: 'Indianapolis Colts',
    city: 'Indianapolis',
    abbreviation: 'IND',
    conference: 'AFC',
    division: 'South',
  },
  {
    name: 'Jacksonville Jaguars',
    city: 'Jacksonville',
    abbreviation: 'JAX',
    conference: 'AFC',
    division: 'South',
  },
  {
    name: 'Kansas City Chiefs',
    city: 'Kansas City',
    abbreviation: 'KC',
    conference: 'AFC',
    division: 'West',
  },
  {
    name: 'Las Vegas Raiders',
    city: 'Las Vegas',
    abbreviation: 'LV',
    conference: 'AFC',
    division: 'West',
  },
  {
    name: 'Los Angeles Chargers',
    city: 'Los Angeles',
    abbreviation: 'LAC',
    conference: 'AFC',
    division: 'West',
  },
  {
    name: 'Los Angeles Rams',
    city: 'Los Angeles',
    abbreviation: 'LAR',
    conference: 'NFC',
    division: 'West',
  },
  {
    name: 'Miami Dolphins',
    city: 'Miami',
    abbreviation: 'MIA',
    conference: 'AFC',
    division: 'East',
  },
  {
    name: 'Minnesota Vikings',
    city: 'Minnesota',
    abbreviation: 'MIN',
    conference: 'NFC',
    division: 'North',
  },
  {
    name: 'New England Patriots',
    city: 'New England',
    abbreviation: 'NE',
    conference: 'AFC',
    division: 'East',
  },
  {
    name: 'New Orleans Saints',
    city: 'New Orleans',
    abbreviation: 'NO',
    conference: 'NFC',
    division: 'South',
  },
  {
    name: 'New York Giants',
    city: 'New York',
    abbreviation: 'NYG',
    conference: 'NFC',
    division: 'East',
  },
  {
    name: 'New York Jets',
    city: 'New York',
    abbreviation: 'NYJ',
    conference: 'AFC',
    division: 'East',
  },
  {
    name: 'Philadelphia Eagles',
    city: 'Philadelphia',
    abbreviation: 'PHI',
    conference: 'NFC',
    division: 'East',
  },
  {
    name: 'Pittsburgh Steelers',
    city: 'Pittsburgh',
    abbreviation: 'PIT',
    conference: 'AFC',
    division: 'North',
  },
  {
    name: 'San Francisco 49ers',
    city: 'San Francisco',
    abbreviation: 'SF',
    conference: 'NFC',
    division: 'West',
  },
  {
    name: 'Seattle Seahawks',
    city: 'Seattle',
    abbreviation: 'SEA',
    conference: 'NFC',
    division: 'West',
  },
  {
    name: 'Tampa Bay Buccaneers',
    city: 'Tampa Bay',
    abbreviation: 'TB',
    conference: 'NFC',
    division: 'South',
  },
  {
    name: 'Tennessee Titans',
    city: 'Tennessee',
    abbreviation: 'TEN',
    conference: 'AFC',
    division: 'South',
  },
  {
    name: 'Washington Commanders',
    city: 'Washington',
    abbreviation: 'WAS',
    conference: 'NFC',
    division: 'East',
  },
];

export const TEAM_ALIAS_TO_ABBR: Record<string, string> = NFL_TEAM_SEED.reduce<
  Record<string, string>
>(
  (acc, team) => {
    acc[normalizeTeamName(team.name)] = team.abbreviation;
    const nickname = team.name.split(' ').at(-1);
    if (nickname) {
      acc[normalizeTeamName(nickname)] = team.abbreviation;
    }
    return acc;
  },
  {
    [normalizeTeamName('Cardinals')]: 'ARI',
    [normalizeTeamName('Falcons')]: 'ATL',
    [normalizeTeamName('Ravens')]: 'BAL',
    [normalizeTeamName('Bills')]: 'BUF',
    [normalizeTeamName('Panthers')]: 'CAR',
    [normalizeTeamName('Bears')]: 'CHI',
    [normalizeTeamName('Bengals')]: 'CIN',
    [normalizeTeamName('Browns')]: 'CLE',
    [normalizeTeamName('Cowboys')]: 'DAL',
    [normalizeTeamName('Broncos')]: 'DEN',
    [normalizeTeamName('Lions')]: 'DET',
    [normalizeTeamName('Packers')]: 'GB',
    [normalizeTeamName('Texans')]: 'HOU',
    [normalizeTeamName('Colts')]: 'IND',
    [normalizeTeamName('Jaguars')]: 'JAX',
    [normalizeTeamName('Chiefs')]: 'KC',
    [normalizeTeamName('Raiders')]: 'LV',
    [normalizeTeamName('Chargers')]: 'LAC',
    [normalizeTeamName('Rams')]: 'LAR',
    [normalizeTeamName('Dolphins')]: 'MIA',
    [normalizeTeamName('Vikings')]: 'MIN',
    [normalizeTeamName('Patriots')]: 'NE',
    [normalizeTeamName('Saints')]: 'NO',
    [normalizeTeamName('Giants')]: 'NYG',
    [normalizeTeamName('Jets')]: 'NYJ',
    [normalizeTeamName('Eagles')]: 'PHI',
    [normalizeTeamName('Steelers')]: 'PIT',
    [normalizeTeamName('49ers')]: 'SF',
    [normalizeTeamName('Seahawks')]: 'SEA',
    [normalizeTeamName('Buccaneers')]: 'TB',
    [normalizeTeamName('Titans')]: 'TEN',
    [normalizeTeamName('Commanders')]: 'WAS',
    [normalizeTeamName('Washington Football Team')]: 'WAS',
    [normalizeTeamName('Washington Redskins')]: 'WAS',
    [normalizeTeamName('Oakland Raiders')]: 'LV',
    [normalizeTeamName('St. Louis Rams')]: 'LAR',
    [normalizeTeamName('San Diego Chargers')]: 'LAC',

    [normalizeTeamName('Cardinals')]: 'ARI',
    [normalizeTeamName('Falcons')]: 'ATL',
    [normalizeTeamName('Ravens')]: 'BAL',
    [normalizeTeamName('Bills')]: 'BUF',
    [normalizeTeamName('Panthers')]: 'CAR',
    [normalizeTeamName('Bears')]: 'CHI',
    [normalizeTeamName('Bengals')]: 'CIN',
    [normalizeTeamName('Browns')]: 'CLE',
    [normalizeTeamName('Cowboys')]: 'DAL',
    [normalizeTeamName('Broncos')]: 'DEN',
    [normalizeTeamName('Lions')]: 'DET',
    [normalizeTeamName('Packers')]: 'GB',
    [normalizeTeamName('Texans')]: 'HOU',
    [normalizeTeamName('Colts')]: 'IND',
    [normalizeTeamName('Jaguars')]: 'JAX',
    [normalizeTeamName('Chiefs')]: 'KC',
    [normalizeTeamName('Raiders')]: 'LV',
    [normalizeTeamName('Chargers')]: 'LAC',
    [normalizeTeamName('Rams')]: 'LAR',
    [normalizeTeamName('Dolphins')]: 'MIA',
    [normalizeTeamName('Vikings')]: 'MIN',
    [normalizeTeamName('Patriots')]: 'NE',
    [normalizeTeamName('Saints')]: 'NO',
    [normalizeTeamName('Giants')]: 'NYG',
    [normalizeTeamName('Jets')]: 'NYJ',
    [normalizeTeamName('Eagles')]: 'PHI',
    [normalizeTeamName('Steelers')]: 'PIT',
    [normalizeTeamName('49ers')]: 'SF',
    [normalizeTeamName('Seahawks')]: 'SEA',
    [normalizeTeamName('Buccaneers')]: 'TB',
    [normalizeTeamName('Titans')]: 'TEN',
    [normalizeTeamName('Commanders')]: 'WAS',
  },
);

export const syncTeams = () => NFL_TEAM_SEED;

export const mapCanonicalTeamToUnifiedTeam = (team: CanonicalTeamSeed): UnifiedTeam => ({
  id: team.abbreviation,
  name: team.name,
  abbr: team.abbreviation,
  conference: team.conference,
  division: team.division,
});

export const mapCanonicalTeamsToUnifiedTeams = (teams: CanonicalTeamSeed[]): UnifiedTeam[] =>
  teams.map(mapCanonicalTeamToUnifiedTeam);
