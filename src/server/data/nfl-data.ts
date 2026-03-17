import seedData from './nfl-data.json';

export type IngestedTeam = {
  id: string;
  name: string;
  city: string;
  abbreviation: string;
  conference: 'AFC' | 'NFC';
  division: 'North' | 'South' | 'East' | 'West';
  normalizedName: string;
};

export type IngestedPlayer = {
  id: string;
  teamAbbr: string;
  fullName: string;
  normalizedName: string;
  position: string;
  jerseyNumber: string | null;
};

export type IngestedTeamCap = {
  teamAbbr: string;
  teamName: string;
  capSpace: number | null;
  effectiveCapSpace: number | null;
  totalCapSpending: number | null;
  deadCap: number | null;
  updatedAt: string;
};

export type IngestedContract = {
  playerId: string;
  teamId: string;
  source: 'overthecap';
  externalSourceKey: string | null;
  contractStatus: string | null;
  yearsRemaining: number | null;
  contractValue: number | null;
  averagePerYear: number | null;
  guaranteedMoney: number | null;
  fullyGuaranteedMoney: number | null;
  signingBonus: number | null;
  rosterBonus: number | null;
  workoutBonus: number | null;
  restructureMetadata: Record<string, unknown> | null;
  postJune1Savings: number | null;
  releaseSavings: number | null;
  deadCap: number | null;
  capHitCurrentYear: number | null;
  capHitFutureYears: Record<string, number> | null;
  baseSalary: number | null;
  guaranteedRemaining: number | null;
  releaseSavingsEstimate: number | null;
  deadCapEstimate: number | null;
  contractLastSyncedAt: string;
  rawContractPayload: Record<string, unknown>;
};

export type IngestedLeagueData = {
  updatedAt: string;
  teams: IngestedTeam[];
  players: IngestedPlayer[];
  cap: IngestedTeamCap[];
  contracts: IngestedContract[];
};

const parsedSeed = seedData as Partial<IngestedLeagueData>;

export const NFL_LEAGUE_DATA: IngestedLeagueData = {
  updatedAt: parsedSeed.updatedAt ?? new Date(0).toISOString(),
  teams: parsedSeed.teams ?? [],
  players: parsedSeed.players ?? [],
  cap: parsedSeed.cap ?? [],
  contracts: parsedSeed.contracts ?? [],
};
