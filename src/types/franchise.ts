export type SeasonOutcome =
  | 'Missed Playoffs'
  | 'Wild Card Exit'
  | 'Divisional Exit'
  | 'Conference Championship Exit'
  | 'Super Bowl Runner-Up'
  | 'Super Bowl Champion';

export type SeasonLeaderCategory =
  | 'Passing Yards'
  | 'Pass TD'
  | 'Rushing Yards'
  | 'Rush TD'
  | 'Receptions'
  | 'Receiving Yards'
  | 'Receiving TD'
  | 'Tackles'
  | 'Sacks'
  | 'Interceptions';

export type SeasonLeaderStat = {
  category: SeasonLeaderCategory;
  playerId: string;
  name: string;
  position: string;
  headshotUrl?: string | null;
  value: number;
  valueLabel: string;
};

export type SeasonImpactAddition = {
  id: string;
  name: string;
  position: string;
  headshotUrl?: string | null;
  acquisitionType: 'Signed' | 'Traded For' | 'Drafted';
  note: string;
  rating?: number | null;
};

export type SeasonRecapSnapshot = {
  year: number;
  teamAbbr: string;
  teamName: string;
  wins: number;
  losses: number;
  divisionFinish: string;
  playoffSeed: number | null;
  madePlayoffs: boolean;
  seasonOutcome: SeasonOutcome;
  trajectory: string;
  overall: number | null;
  overallDelta: number | null;
  summaryLines: string[];
  keyNotes: string[];
  leaders: SeasonLeaderStat[];
  impactAdditions: SeasonImpactAddition[];
};
