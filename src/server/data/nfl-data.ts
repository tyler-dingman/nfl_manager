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

export type IngestedLeagueData = {
  updatedAt: string;
  teams: IngestedTeam[];
  players: IngestedPlayer[];
  cap: IngestedTeamCap[];
};

export const NFL_LEAGUE_DATA: IngestedLeagueData = seedData as IngestedLeagueData;
