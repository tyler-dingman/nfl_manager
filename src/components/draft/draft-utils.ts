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
  { abbr: 'LV' },
  { abbr: 'NYJ' },
  { abbr: 'ARI' },
  { abbr: 'TEN' },
  { abbr: 'NYG' },
  { abbr: 'CLE' },
  { abbr: 'WAS' },
  { abbr: 'NO' },
  { abbr: 'KC' },
  { abbr: 'CIN' },
  { abbr: 'MIA' },
  { abbr: 'DAL' },
  { abbr: 'LAR' },
  { abbr: 'BAL' },
  { abbr: 'TB' },
  { abbr: 'NYJ' },
  { abbr: 'DET' },
  { abbr: 'MIN' },
  { abbr: 'CAR' },
  { abbr: 'DAL' },
  { abbr: 'PIT' },
  { abbr: 'LAC' },
  { abbr: 'PHI' },
  { abbr: 'CLE' },
  { abbr: 'CHI' },
  { abbr: 'BUF' },
  { abbr: 'SF' },
  { abbr: 'HOU' },
  { abbr: 'LAR' },
  { abbr: 'DEN' },
  { abbr: 'NE' },
  { abbr: 'SEA' },
];

const logoUrlFor = (abbr: string) =>
  `https://static.www.nfl.com/t_q-best/league/api/clubs/logos/${abbr}.svg`;

export const getTeamNeeds = (abbr: string, teams: TeamDTO[]): string[] =>
  teams.find((team) => team.abbr === abbr)?.teamNeeds ?? ['QB', 'OT', 'CB'];

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
      needs: team?.teamNeeds ?? ['QB', 'OT', 'CB'],
      record: pick.record ?? null,
      note: pick.note ?? null,
    };
  });
};
