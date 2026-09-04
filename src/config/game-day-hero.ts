export const GAME_DAY_HERO_ASSETS: Partial<Record<string, string>> = {
  KC: '/images/gameday/stadium/kc/gameday.png',
};

export const TEAM_TIME_ZONES: Record<string, string> = {
  ARI: 'America/Phoenix',
  ATL: 'America/New_York',
  BAL: 'America/New_York',
  BUF: 'America/New_York',
  CAR: 'America/New_York',
  CHI: 'America/Chicago',
  CIN: 'America/New_York',
  CLE: 'America/New_York',
  DAL: 'America/Chicago',
  DEN: 'America/Denver',
  DET: 'America/Detroit',
  GB: 'America/Chicago',
  HOU: 'America/Chicago',
  IND: 'America/Indiana/Indianapolis',
  JAX: 'America/New_York',
  KC: 'America/Chicago',
  LAC: 'America/Los_Angeles',
  LAR: 'America/Los_Angeles',
  LV: 'America/Los_Angeles',
  MIA: 'America/New_York',
  MIN: 'America/Chicago',
  NE: 'America/New_York',
  NO: 'America/Chicago',
  NYG: 'America/New_York',
  NYJ: 'America/New_York',
  PHI: 'America/New_York',
  PIT: 'America/New_York',
  SEA: 'America/Los_Angeles',
  SF: 'America/Los_Angeles',
  TB: 'America/New_York',
  TEN: 'America/Chicago',
  WAS: 'America/New_York',
};

export const gameDayHeroAsset = (teamAbbr: string) => GAME_DAY_HERO_ASSETS[teamAbbr];

export const teamTimeZone = (teamAbbr: string) => TEAM_TIME_ZONES[teamAbbr] ?? 'America/New_York';
