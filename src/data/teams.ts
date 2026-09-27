import { NFL_TEAM_SEED } from '@/server/ingest/teams';
import { getTeamBrandTheme } from '@/lib/team-brand-themes';

export type TeamInfo = {
  id: string;
  abbr: string;
  name: string;
  city: string;
  fanbase: string;
  colors: [string, string];
  logoUrl: string;
};

const TEAM_FANBASES: Record<string, string> = {
  ARI: 'THE RED SEA',
  ATL: 'FALCONS NATION',
  BAL: 'THE RAVENS FLOCK',
  BUF: 'BILLS MAFIA',
  CAR: 'PANTHERS NATION',
  CHI: 'BEARS NATION',
  CIN: 'WHO DEY NATION',
  CLE: 'THE DAWG POUND',
  DAL: 'COWBOYS NATION',
  DEN: 'BRONCOS COUNTRY',
  DET: 'ONE PRIDE',
  GB: 'PACKERS NATION',
  HOU: 'TEXANS NATION',
  IND: 'COLTS NATION',
  JAX: 'DUUUVAL',
  KC: 'CHIEFS KINGDOM',
  LV: 'RAIDER NATION',
  LAC: 'BOLT FAM',
  LAR: 'RAMS HOUSE',
  MIA: 'DOLPHINS NATION',
  MIN: 'SKOL NATION',
  NE: 'PATRIOTS NATION',
  NO: 'WHO DAT NATION',
  NYG: 'BIG BLUE',
  NYJ: 'JETS NATION',
  PHI: 'EAGLES NATION',
  PIT: 'STEELER NATION',
  SF: 'THE FAITHFUL',
  SEA: 'THE 12s',
  TB: 'THE KREWE',
  TEN: 'TITANS NATION',
  WAS: 'COMMANDERS NATION',
};

export const nflLogoUrl = (abbr: string) =>
  `https://static.www.nfl.com/t_q-best/league/api/clubs/logos/${abbr}.svg`;

export const TEAM_LIST: TeamInfo[] = NFL_TEAM_SEED.map((team) => ({
  id: team.abbreviation.toLowerCase(),
  abbr: team.abbreviation,
  name: team.name,
  city: team.city,
  fanbase: TEAM_FANBASES[team.abbreviation],
  colors: (() => {
    const theme = getTeamBrandTheme(team.abbreviation);
    return [theme.primary, theme.secondary] as [string, string];
  })(),
  logoUrl: nflLogoUrl(team.abbreviation),
}));
