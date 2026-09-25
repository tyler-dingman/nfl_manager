import { TEAM_LIST } from '@/data/teams';

export const TEAM_HERO_COPY = {
  BUF: { line1: 'Bills', line2: 'Mafia.' },
  MIA: { line1: 'Fins', line2: 'Up!' },
  NE: { line1: 'Do Your', line2: 'Job.' },
  NYJ: { line1: 'J-E-T-S!', line2: 'Jets! Jets! Jets!' },
  BAL: { line1: 'Play Like a', line2: 'Raven.' },
  CIN: { line1: 'Who', line2: 'Dey?!' },
  CLE: { line1: 'The Dawg', line2: 'Pound.' },
  PIT: { line1: 'Here We Go', line2: 'Steelers.' },
  HOU: { line1: 'Bulls on', line2: 'Parade.' },
  IND: { line1: 'For the', line2: 'Shoe.' },
  JAX: { line1: 'Duuu', line2: 'val!' },
  TEN: { line1: 'Titan', line2: 'Up!' },
  DEN: { line1: 'United in', line2: 'Orange.' },
  KC: { line1: 'Home of the', line2: 'Chiefs.' },
  LV: { line1: 'Just Win,', line2: 'Baby.' },
  LAC: { line1: 'Bolt', line2: 'Up!' },
  DAL: { line1: "How 'Bout Them", line2: 'Cowboys!' },
  NYG: { line1: 'Big', line2: 'Blue.' },
  PHI: { line1: 'Fly, Eagles,', line2: 'Fly!' },
  WAS: { line1: 'Hail to the', line2: 'Commanders.' },
  CHI: { line1: 'Bear', line2: 'Down.' },
  DET: { line1: 'One', line2: 'Pride.' },
  GB: { line1: 'Go Pack', line2: 'Go!' },
  MIN: { line1: 'Skol', line2: 'Vikings!' },
  ATL: { line1: 'Rise', line2: 'Up!' },
  CAR: { line1: 'Keep', line2: 'Pounding.' },
  NO: { line1: 'Who', line2: 'Dat?' },
  TB: { line1: 'Fire the', line2: 'Cannons!' },
  ARI: { line1: 'Rise Up', line2: 'Red Sea.' },
  LAR: { line1: 'Whose House?', line2: 'Rams House!' },
  SF: { line1: 'Faithful to', line2: 'the Bay.' },
  SEA: { line1: 'The', line2: '12s' },
} as const;

const FALLBACK = { line1: 'Your team.', line2: 'Every day.' };
export function getTeamHeroCopy(teamAbbr?: string | null) {
  return TEAM_HERO_COPY[teamAbbr?.toUpperCase() as keyof typeof TEAM_HERO_COPY] ?? FALLBACK;
}

export function getTeamHeroDescription(teamAbbr?: string | null): string {
  const city = TEAM_LIST.find((team) => team.abbr === teamAbbr?.toUpperCase())?.city;
  return `Your home for everything ${city ? `${city} ` : ''}football — the latest news, analysis, roster moves, and fan conversation. Run the team, test your knowledge, and research your next parlay.`;
}
