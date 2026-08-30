export type TeamBrandTheme = {
  primary: string;
  secondary: string;
  dark: string;
  light: string;
};

export const DEFAULT_TEAM_BRAND_THEME: TeamBrandTheme = {
  primary: '#FF3D38',
  secondary: '#F4D9B7',
  dark: '#FF3D38',
  light: '#F4D9B7',
};

export const TEAM_BRAND_THEMES: Record<string, TeamBrandTheme> = {
  ARI: { primary: '#97233F', secondary: '#FFB612', dark: '#000000', light: '#FFFFFF' },
  ATL: { primary: '#A71930', secondary: '#A5ACAF', dark: '#000000', light: '#FFFFFF' },
  BAL: { primary: '#241773', secondary: '#9E7C0C', dark: '#000000', light: '#FFFFFF' },
  BUF: { primary: '#00338D', secondary: '#C60C30', dark: '#001B44', light: '#FFFFFF' },
  CAR: { primary: '#0085CA', secondary: '#BFC0BF', dark: '#101820', light: '#FFFFFF' },
  CHI: { primary: '#0B162A', secondary: '#C83803', dark: '#05101F', light: '#FFFFFF' },
  CIN: { primary: '#FB4F14', secondary: '#FFFFFF', dark: '#000000', light: '#FFFFFF' },
  CLE: { primary: '#311D00', secondary: '#FF3C00', dark: '#1C1000', light: '#FFFFFF' },
  DAL: { primary: '#041E42', secondary: '#869397', dark: '#001733', light: '#FFFFFF' },
  DEN: { primary: '#FB4F14', secondary: '#002244', dark: '#00152B', light: '#FFFFFF' },
  DET: { primary: '#0076B6', secondary: '#B0B7BC', dark: '#08162A', light: '#FFFFFF' },
  GB: { primary: '#203731', secondary: '#FFB612', dark: '#10251F', light: '#FFFFFF' },
  HOU: { primary: '#03202F', secondary: '#A71930', dark: '#02131C', light: '#FFFFFF' },
  IND: { primary: '#002C5F', secondary: '#A2AAAD', dark: '#001A38', light: '#FFFFFF' },
  JAX: { primary: '#006778', secondary: '#D7A22A', dark: '#101820', light: '#FFFFFF' },
  KC: { primary: '#E31837', secondary: '#FFB81C', dark: '#8F001C', light: '#FFFFFF' },
  LV: { primary: '#000000', secondary: '#A5ACAF', dark: '#111111', light: '#FFFFFF' },
  LAC: { primary: '#0080C6', secondary: '#FFC20E', dark: '#002A5E', light: '#FFFFFF' },
  LAR: { primary: '#003594', secondary: '#FFA300', dark: '#001D4F', light: '#FFFFFF' },
  MIA: { primary: '#008E97', secondary: '#FC4C02', dark: '#005778', light: '#FFFFFF' },
  MIN: { primary: '#4F2683', secondary: '#FFC62F', dark: '#2F1554', light: '#FFFFFF' },
  NE: { primary: '#002244', secondary: '#C60C30', dark: '#00152B', light: '#FFFFFF' },
  NO: { primary: '#D3BC8D', secondary: '#FFFFFF', dark: '#101820', light: '#FFFFFF' },
  NYG: { primary: '#0B2265', secondary: '#A71930', dark: '#06163E', light: '#FFFFFF' },
  NYJ: { primary: '#125740', secondary: '#FFFFFF', dark: '#0A3226', light: '#FFFFFF' },
  PHI: { primary: '#004C54', secondary: '#A5ACAF', dark: '#002D32', light: '#FFFFFF' },
  PIT: { primary: '#FFB612', secondary: '#FFFFFF', dark: '#101820', light: '#FFFFFF' },
  SF: { primary: '#AA0000', secondary: '#B3995D', dark: '#650000', light: '#FFFFFF' },
  SEA: { primary: '#002244', secondary: '#69BE28', dark: '#00162D', light: '#FFFFFF' },
  TB: { primary: '#D50A0A', secondary: '#B1BABF', dark: '#34302B', light: '#FFFFFF' },
  TEN: { primary: '#0C2340', secondary: '#4B92DB', dark: '#07162A', light: '#FFFFFF' },
  WAS: { primary: '#5A1414', secondary: '#FFB612', dark: '#360B0B', light: '#FFFFFF' },
};

export const getTeamBrandTheme = (abbr?: string | null) =>
  (abbr ? TEAM_BRAND_THEMES[abbr.toUpperCase()] : undefined) ?? DEFAULT_TEAM_BRAND_THEME;

export const TEAM_BRANDED_LOGO_URLS: Record<string, string> = {
  ARI: '/images/team_branded_logos/down-distance-arizona-cardinals.png',
  ATL: '/images/team_branded_logos/down-distance-atlanta-falcons.png',
  BAL: '/images/team_branded_logos/down-distance-baltimore-ravens.png',
  BUF: '/images/team_branded_logos/down-distance-buffalo-bills.png',
  CAR: '/images/team_branded_logos/down-distance-carolina-panthers.png',
  CHI: '/images/team_branded_logos/down-distance-chicago-bears.png',
  CIN: '/images/team_branded_logos/down-distance-cincinnati-bengals.png',
  CLE: '/images/team_branded_logos/down-distance-cleveland-browns.png',
  DAL: '/images/team_branded_logos/down-distance-dallas-cowboys.png',
  DEN: '/images/team_branded_logos/down-distance-denver-broncos.png',
  DET: '/images/team_branded_logos/down-distance-detroit-lions.png',
  GB: '/images/team_branded_logos/down-distance-green-bay-packers.png',
  HOU: '/images/team_branded_logos/down-distance-houston-texans.png',
  IND: '/images/team_branded_logos/down-distance-indianapolis-colts.png',
  JAX: '/images/team_branded_logos/down-distance-jacksonville-jaguars.png',
  KC: '/images/team_branded_logos/down-distance-kansas-city-chiefs.png',
  LV: '/images/team_branded_logos/down-distance-las-vegas-raiders.png',
  LAC: '/images/team_branded_logos/down-distance-los-angeles-chargers.png',
  LAR: '/images/team_branded_logos/down-distance-los-angeles-rams.png',
  MIA: '/images/team_branded_logos/down-distance-miami-dolphins.png',
  MIN: '/images/team_branded_logos/down-distance-minnesota-vikings.png',
  NE: '/images/team_branded_logos/down-distance-new-england-patriots.png',
  NO: '/images/team_branded_logos/down-distance-new-orleans-saints.png',
  NYG: '/images/team_branded_logos/down-distance-new-york-giants.png',
  NYJ: '/images/team_branded_logos/down-distance-new-york-jets.png',
  PHI: '/images/team_branded_logos/down-distance-philadelphia-eagles.png',
  PIT: '/images/team_branded_logos/down-distance-pittsburgh-steelers.png',
  SF: '/images/team_branded_logos/down-distance-san-francisco-49ers.png',
  SEA: '/images/team_branded_logos/down-distance-seattle-seahawks.png',
  TB: '/images/team_branded_logos/down-distance-tampa-bay-buccaneers.png',
  TEN: '/images/team_branded_logos/down-distance-tennessee-titans.png',
  WAS: '/images/team_branded_logos/down-distance-washington-commanders.png',
};

export const getTeamBrandedLogoUrl = (abbr?: string | null) =>
  (abbr ? TEAM_BRANDED_LOGO_URLS[abbr.toUpperCase()] : undefined) ??
  '/images/down_distance_badge.png';
