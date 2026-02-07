export type TeamInfo = {
  id: string;
  abbr: string;
  name: string;
  colors: [string, string];
  logoUrl: string;
};

export const nflLogoUrl = (abbr: string) =>
  `https://static.www.nfl.com/t_q-best/league/api/clubs/logos/${abbr}.svg`;

const makeTeam = (abbr: string, name: string, colors: [string, string]): TeamInfo => ({
  id: abbr.toLowerCase(),
  abbr,
  name,
  colors,
  logoUrl: nflLogoUrl(abbr),
});

export const TEAM_LIST: TeamInfo[] = [
  makeTeam('ARI', 'Arizona Cardinals', ['#97233F', '#000000']),
  makeTeam('ATL', 'Atlanta Falcons', ['#A71930', '#000000']),
  makeTeam('BAL', 'Baltimore Ravens', ['#241773', '#9E7C0C']),
  makeTeam('BUF', 'Buffalo Bills', ['#00338D', '#C60C30']),
  makeTeam('CAR', 'Carolina Panthers', ['#0085CA', '#101820']),
  makeTeam('CHI', 'Chicago Bears', ['#0B162A', '#C83803']),
  makeTeam('CIN', 'Cincinnati Bengals', ['#FB4F14', '#000000']),
  makeTeam('CLE', 'Cleveland Browns', ['#311D00', '#FF3C00']),
  makeTeam('DAL', 'Dallas Cowboys', ['#003594', '#869397']),
  makeTeam('DEN', 'Denver Broncos', ['#FB4F14', '#002244']),
  makeTeam('DET', 'Detroit Lions', ['#0076B6', '#B0B7BC']),
  makeTeam('GB', 'Green Bay Packers', ['#203731', '#FFB612']),
  makeTeam('HOU', 'Houston Texans', ['#03202F', '#A71930']),
  makeTeam('IND', 'Indianapolis Colts', ['#002C5F', '#A2AAAD']),
  makeTeam('JAX', 'Jacksonville Jaguars', ['#006778', '#D7A22A']),
  makeTeam('KC', 'Kansas City Chiefs', ['#E31837', '#FFB81C']),
  makeTeam('LV', 'Las Vegas Raiders', ['#000000', '#A5ACAF']),
  makeTeam('LAC', 'Los Angeles Chargers', ['#0080C6', '#FFC20E']),
  makeTeam('LAR', 'Los Angeles Rams', ['#003594', '#FFA300']),
  makeTeam('MIA', 'Miami Dolphins', ['#008E97', '#FC4C02']),
  makeTeam('MIN', 'Minnesota Vikings', ['#4F2683', '#FFC62F']),
  makeTeam('NE', 'New England Patriots', ['#002244', '#C60C30']),
  makeTeam('NO', 'New Orleans Saints', ['#D3BC8D', '#101820']),
  makeTeam('NYG', 'New York Giants', ['#0B2265', '#A71930']),
  makeTeam('NYJ', 'New York Jets', ['#125740', '#000000']),
  makeTeam('PHI', 'Philadelphia Eagles', ['#004C54', '#A5ACAF']),
  makeTeam('PIT', 'Pittsburgh Steelers', ['#FFB612', '#101820']),
  makeTeam('SEA', 'Seattle Seahawks', ['#002244', '#69BE28']),
  makeTeam('SF', 'San Francisco 49ers', ['#AA0000', '#B3995D']),
  makeTeam('TB', 'Tampa Bay Buccaneers', ['#D50A0A', '#34302B']),
  makeTeam('TEN', 'Tennessee Titans', ['#0C2340', '#4B92DB']),
  makeTeam('WAS', 'Washington Commanders', ['#5A1414', '#FFB612']),
];
