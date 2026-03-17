import seedData from './nfl-data.json';

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
  age: number | null;
  height: string | null;
  weight: number | null;
};

export type UnifiedContract = {
  playerId: string;
  teamAbbr: string;
  capHit: number | null;
  guaranteed: number | null;
  years: number | null;
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
  cap: UnifiedCap[];
  updatedAt: string;
};

const parsedSeed = seedData as Partial<IngestedLeagueData>;

export const NFL_LEAGUE_DATA: IngestedLeagueData = {
  updatedAt: parsedSeed.updatedAt ?? new Date(0).toISOString(),
  teams: parsedSeed.teams ?? [],
  players: parsedSeed.players ?? [],
  contracts: parsedSeed.contracts ?? [],
  cap: parsedSeed.cap ?? [],
};
