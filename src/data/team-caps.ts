import { NFL_LEAGUE_DATA } from '@/server/data/nfl-data';
import { NFL_TEAM_SEED } from '@/server/ingest/teams';

export const TEAM_CAP_SPACE: Array<{ teamAbbr: string; capSpace: number }> = NFL_TEAM_SEED.map(
  (team) => {
    const capRecord = NFL_LEAGUE_DATA.cap.find((entry) => entry.teamAbbr === team.abbreviation);
    return {
      teamAbbr: team.abbreviation,
      capSpace: capRecord?.availableCap ?? 0,
    };
  },
);
