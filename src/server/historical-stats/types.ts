export type SeasonType = 'REG' | 'POST';
export type HomeAway = 'HOME' | 'AWAY';

export type HistoricalPlayerGame = {
  gameId: string;
  date: string;
  kickoffAt?: string | null;
  season: number;
  week: number;
  seasonType: SeasonType;
  playerId: string;
  playerName: string;
  teamId: string;
  opponentTeamId: string;
  homeTeamId?: string;
  homeAway: HomeAway;
  position: string | null;
  passingAttempts: number | null;
  passingCompletions: number | null;
  passingYards: number | null;
  passingTds: number | null;
  interceptions: number | null;
  carries: number | null;
  rushingYards: number | null;
  rushingTds: number | null;
  targets: number | null;
  receptions: number | null;
  receivingYards: number | null;
  receivingTds: number | null;
  opponentSeasonStrength?: TeamSeasonStrength | null;
  previousTeamKickoffAt?: string | null;
};

export type TeamSeasonStrength = {
  season: number;
  teamId: string;
  passDefenseRank: number;
  passingYardsAllowedPerGame: number;
  rushDefenseRank: number;
  rushingYardsAllowedPerGame: number;
  scoringDefenseRank: number;
  pointsAllowedPerGame: number;
  totalDefenseRank: number;
  totalYardsAllowedPerGame: number;
};

export type HistoricalStatType =
  | 'PASSING_YARDS'
  | 'PASSING_RUSHING_YARDS'
  | 'PASSING_TDS'
  | 'PASSING_COMPLETIONS'
  | 'PASSING_ATTEMPTS'
  | 'INTERCEPTIONS'
  | 'RUSHING_YARDS'
  | 'RUSHING_ATTEMPTS'
  | 'RUSHING_TDS'
  | 'RECEIVING_YARDS'
  | 'RECEPTIONS'
  | 'RECEIVING_TDS'
  | 'RUSH_RECEIVE_YARDS'
  | 'RUSHING_RECEIVING_YARDS'
  | 'ANYTIME_TD';
