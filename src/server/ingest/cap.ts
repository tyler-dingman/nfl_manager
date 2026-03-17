import { fetchTeamCap } from '@/server/data-sources/overthecap';
import { normalizeTeamName } from './normalize';
import { NFL_TEAM_SEED, TEAM_ALIAS_TO_ABBR } from './teams';
import type { IngestedTeamCap } from '@/server/data/nfl-data';

export type CapSyncResult = {
  cap: IngestedTeamCap[];
  updatedCount: number;
  unmatched: string[];
};

export const syncCap = async (existingCap: IngestedTeamCap[] = []): Promise<CapSyncResult> => {
  const scrapeRows = await fetchTeamCap();
  const now = new Date().toISOString();

  const existingByTeam = new Map(existingCap.map((entry) => [entry.teamAbbr, entry]));
  const next = new Map<string, IngestedTeamCap>();
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
      teamName: seedMatch?.name ?? row.teamName,
      capSpace: row.capSpace,
      effectiveCapSpace: row.effectiveCapSpace,
      totalCapSpending: row.totalCapSpending,
      deadCap: row.deadCap,
      updatedAt: now,
    });
  }

  let updatedCount = 0;
  for (const [abbr, row] of next.entries()) {
    const existing = existingByTeam.get(abbr);
    if (
      !existing ||
      existing.capSpace !== row.capSpace ||
      existing.deadCap !== row.deadCap ||
      existing.effectiveCapSpace !== row.effectiveCapSpace ||
      existing.totalCapSpending !== row.totalCapSpending
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
