import { fetchTeamCap } from '@/server/data-sources/overthecap';
import { normalizeTeamName, normalizeTeamSlug } from './normalize';
import { NFL_TEAM_SEED, TEAM_ALIAS_TO_ABBR } from './teams';
import type { UnifiedCap } from '@/server/data/nfl-data';

export type CapSyncResult = {
  cap: UnifiedCap[];
  updatedCount: number;
  unmatched: string[];
};

const resolveTeamAbbr = (teamName: string, teamSlug: string | null): string | null => {
  const normalizedName = normalizeTeamName(teamName);
  const fromAlias = TEAM_ALIAS_TO_ABBR[normalizedName];
  if (fromAlias) return fromAlias;

  const nameMatch = NFL_TEAM_SEED.find((team) => normalizeTeamName(team.name) === normalizedName);
  if (nameMatch) return nameMatch.abbreviation;

  const trimmed = teamName.trim().toUpperCase();
  if (/^[A-Z]{2,3}$/.test(trimmed)) {
    const abbrMatch = NFL_TEAM_SEED.find((team) => team.abbreviation === trimmed);
    if (abbrMatch) return abbrMatch.abbreviation;
  }

  if (teamSlug) {
    const normalizedSlug = normalizeTeamSlug(teamSlug);
    const slugMatch = NFL_TEAM_SEED.find((team) => normalizeTeamSlug(team.name) === normalizedSlug);
    if (slugMatch) return slugMatch.abbreviation;
  }

  return null;
};

export const syncCap = async (existingCap: UnifiedCap[] = []): Promise<CapSyncResult> => {
  const scrapeRows = await fetchTeamCap();

  const existingByTeam = new Map(existingCap.map((entry) => [entry.teamAbbr, entry]));
  const next = new Map<string, UnifiedCap>();
  const unmatched: string[] = [];

  for (const row of scrapeRows) {
    const teamAbbr = resolveTeamAbbr(row.teamName, row.teamSlug);
    const rowLabel = row.teamSlug ? `${row.teamName} (${row.teamSlug})` : row.teamName;

    if (!teamAbbr) {
      unmatched.push(row.teamName);
      console.warn(`[cap] team mapping failed: source="${rowLabel}" normalized="${row.normalizedTeamName}"`);
      continue;
    }

    console.info(`[cap] rows parsed for ${teamAbbr}: 1`);
    console.info(`[cap] team mapping success: source="${rowLabel}" -> ${teamAbbr}`);

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

  const missingTeams = NFL_TEAM_SEED.filter((team) => !next.has(team.abbreviation)).map(
    (team) => team.abbreviation,
  );
  if (missingTeams.length > 0) {
    console.warn(`[cap] missing cap data for teams: ${missingTeams.join(', ')}`);
  }

  return {
    cap: Array.from(next.values()),
    updatedCount,
    unmatched,
  };
};
