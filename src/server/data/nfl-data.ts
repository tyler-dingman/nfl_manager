import seedData from './nfl-data.json';

export type UnifiedPlayerStats = {
  passingYards?: number;
  passingTD?: number;
  interceptions?: number;
  completionPct?: number;

  rushYards?: number;
  rushTD?: number;
  yardsPerCarry?: number;

  recYards?: number;
  receptions?: number;
  recTD?: number;
  yardsPerCatch?: number;

  tackles?: number;
  sacks?: number;
  tfl?: number;
  qbHits?: number;

  interceptionsDef?: number;
  passDeflections?: number;
  forcedFumbles?: number;
};

export type UnifiedTeam = {
  id: string;
  name: string;
  abbr: string;
  conference: 'AFC' | 'NFC';
  division: 'North' | 'South' | 'East' | 'West';
};

export type UnifiedPlayer = {
  id: string;
  name: string;
  position: string;
  teamAbbr: string;
  baselineRating: number;
  maddenRating: number | null;
  rating: number;
  age: number | null;
  height: string | null;
  weight: number | null;
  headshotUrl: string | null;
  stats: UnifiedPlayerStats;
};

export type UnifiedContract = {
  playerId: string;
  teamAbbr: string;
  contractStatus: string | null;
  capHit: number | null;
  averagePerYear: number | null;
  guaranteed: number | null;
  years: number | null;
  contractEndYear: number | null;
  deadCap: number | null;
  releaseSavings: number | null;
  postJune1Savings: number | null;
};

export type UnifiedFreeAgent = {
  id: string;
  name: string;
  normalizedName: string;
  position: string;
  age: number | null;
  headshotUrl: string | null;
  lastTeamAbbr: string;
  contractStatus: string | null;
  currentTeamAbbr: string | null;
  isUnsigned: boolean;
  capHit: number | null;
  averagePerYear: number | null;
};

export type UnifiedCap = {
  teamAbbr: string;
  totalCap: number | null;
  usedCap: number | null;
  availableCap: number | null;
};

export type IngestedLeagueData = {
  teams: UnifiedTeam[];
  players: UnifiedPlayer[];
  contracts: UnifiedContract[];
  freeAgents: UnifiedFreeAgent[];
  cap: UnifiedCap[];
  updatedAt: string;
};

const parsedSeed = seedData as unknown as Partial<IngestedLeagueData>;

export const NFL_LEAGUE_DATA: IngestedLeagueData = {
  updatedAt: parsedSeed.updatedAt ?? new Date(0).toISOString(),
  teams: parsedSeed.teams ?? [],
  players: parsedSeed.players ?? [],
  contracts: parsedSeed.contracts ?? [],
  freeAgents: parsedSeed.freeAgents ?? [],
  cap: parsedSeed.cap ?? [],
};
