import { fetchTeamCap } from '@/server/data-sources/overthecap';
import { normalizeTeamName } from './normalize';
import { NFL_TEAM_SEED, TEAM_ALIAS_TO_ABBR } from './teams';
import type { UnifiedCap } from '@/server/data/nfl-data';

export type CapSyncResult = {
  cap: UnifiedCap[];
  updatedCount: number;
  unmatched: string[];
};

export const syncCap = async (existingCap: UnifiedCap[] = []): Promise<CapSyncResult> => {
  const scrapeRows = await fetchTeamCap();

  const existingByTeam = new Map(existingCap.map((entry) => [entry.teamAbbr, entry]));
  const next = new Map<string, UnifiedCap>();
  const unmatched: string[] = [];

  for (const row of scrapeRows) {
    const normalized = normalizeTeamName(row.teamName);
    const mapped = TEAM_ALIAS_TO_ABBR[normalized];
    const seedMatch = NFL_TEAM_SEED.find((team) => normalizeTeamName(team.name) === normalized);
    const teamAbbr = mapped ?? seedMatch?.abbreviation;

    if (!teamAbbr) {
      unmatched.push(row.teamName);
      continue;
    }

    next.set(teamAbbr, {
      teamAbbr,
      totalCap: row.totalCapSpending,
      usedCap: row.totalCapSpending,
      availableCap: row.capSpace,
    });
  }

  let updatedCount = 0;
  for (const [abbr, row] of next.entries()) {
    const existing = existingByTeam.get(abbr);
    if (
      !existing ||
      existing.totalCap !== row.totalCap ||
      existing.usedCap !== row.usedCap ||
      existing.availableCap !== row.availableCap
    ) {
      updatedCount += 1;
    }
  }

  return {
    cap: Array.from(next.values()),
    updatedCount,
    unmatched,
  };
};
