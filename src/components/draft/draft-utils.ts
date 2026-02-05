import type { TeamDTO } from '@/types/team';

export type DraftOrderTeam = {
  pickNumber: number;
  abbr: string;
  name: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  needs: string[];
};

export const ROUND_ONE_PICK_ORDER = [
  'LV',
  'NYJ',
  'ARI',
  'TEN',
  'NYG',
  'CLE',
  'WAS',
  'NO',
  'KC',
  'CIN',
  'MIA',
  'DAL',
  'ATL',
  'BAL',
  'TB',
  'IND',
  'DET',
  'MIN',
  'CAR',
  'GB',
  'PIT',
  'LAC',
  'PHI',
  'JAX',
  'CHI',
  'BUF',
  'SF',
  'HOU',
  'LAR',
  'DEN',
  'NE',
  'SEA',
] as const;

const NEEDS_POOL = ['QB', 'RB', 'WR', 'TE', 'OT', 'IOL', 'EDGE', 'DT', 'LB', 'CB', 'S'] as const;

const logoUrlFor = (abbr: string) =>
  `https://static.www.nfl.com/t_q-best/league/api/clubs/logos/${abbr}.svg`;

export const getTeamNeeds = (abbr: string): string[] => {
  const hash = abbr
    .split('')
    .reduce((sum, char, index) => sum + char.charCodeAt(0) * (index + 7), 0);

  const first = NEEDS_POOL[hash % NEEDS_POOL.length];
  const second = NEEDS_POOL[(hash + 3) % NEEDS_POOL.length];
  const third = NEEDS_POOL[(hash + 6) % NEEDS_POOL.length];

  return Array.from(new Set([first, second, third]));
};

export const buildRoundOneOrder = (teams: TeamDTO[]): DraftOrderTeam[] => {
  const teamsByAbbr = new Map(teams.map((team) => [team.abbr, team]));

  return ROUND_ONE_PICK_ORDER.map((abbr, index) => {
    const team = teamsByAbbr.get(abbr);
    return {
      pickNumber: index + 1,
      abbr,
      name: team?.name ?? abbr,
      logoUrl: team?.logoUrl ?? logoUrlFor(abbr),
      primaryColor: team?.colors[0] ?? '#1f2937',
      secondaryColor: team?.colors[1] ?? '#9ca3af',
      needs: getTeamNeeds(abbr),
    };
  });
};
