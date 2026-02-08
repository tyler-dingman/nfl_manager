import type { TeamDTO } from '@/types/team';

export type DraftOrderTeam = {
  pickNumber: number;
  abbr: string;
  name: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  needs: string[];
  record?: string | null;
  note?: string | null;
};

type RoundOnePick = {
  abbr: string;
  record?: string | null;
  note?: string | null;
};

export const ROUND_ONE_PICK_ORDER: RoundOnePick[] = [
  { abbr: 'LV', record: '3-14' },
  { abbr: 'NYJ', record: '3-14' },
  { abbr: 'ARI', record: '3-14' },
  { abbr: 'TEN', record: '3-14' },
  { abbr: 'NYG', record: '4-13' },
  { abbr: 'CLE', record: '5-12' },
  { abbr: 'WAS', record: '5-12' },
  { abbr: 'NO', record: '6-11' },
  { abbr: 'KC', record: '6-11' },
  { abbr: 'CIN', record: '6-11' },
  { abbr: 'MIA', record: '7-10' },
  { abbr: 'DAL', record: '7-9-1' },
  { abbr: 'LAR', record: '8-9', note: 'Acquired from ATL' },
  { abbr: 'BAL', record: '8-9' },
  { abbr: 'TB', record: '8-9' },
  { abbr: 'NYJ', record: '8-9', note: 'Acquired from IND' },
  { abbr: 'DET', record: '9-8' },
  { abbr: 'MIN', record: '9-8' },
  { abbr: 'CAR', record: '8-9' },
  { abbr: 'DAL', record: '9-7-1', note: 'Acquired from GB' },
  { abbr: 'PIT', record: '10-7' },
  { abbr: 'LAC', record: '11-6' },
  { abbr: 'PHI', record: '11-6' },
  { abbr: 'CLE', record: '13-4', note: 'Acquired from JAX' },
  { abbr: 'CHI', record: '11-6' },
  { abbr: 'BUF', record: '12-5' },
  { abbr: 'SF', record: '12-5' },
  { abbr: 'HOU', record: '12-5' },
  { abbr: 'LAR', record: '12-5' },
  { abbr: 'DEN', record: '14-3' },
  { abbr: 'NE', record: null },
  { abbr: 'SEA', record: null },
];

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

  return ROUND_ONE_PICK_ORDER.map((pick, index) => {
    const team = teamsByAbbr.get(pick.abbr);
    return {
      pickNumber: index + 1,
      abbr: pick.abbr,
      name: team?.name ?? pick.abbr,
      logoUrl: team?.logoUrl ?? logoUrlFor(pick.abbr),
      primaryColor: team?.colors[0] ?? '#1f2937',
      secondaryColor: team?.colors[1] ?? '#9ca3af',
      needs: getTeamNeeds(pick.abbr),
      record: pick.record ?? null,
      note: pick.note ?? null,
    };
  });
};
