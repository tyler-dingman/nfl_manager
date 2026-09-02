import { TEAM_LIST } from '@/data/teams';
import { teamContentEngine } from '@/features/content/content-engine';
import { getGeneratedTeamBriefings } from '@/features/content/generated-briefings';

export async function loadTeamBriefings(teamAbbr: string) {
  const normalized = teamAbbr.toUpperCase();
  const team = TEAM_LIST.find((candidate) => candidate.abbr === normalized);
  const generated = getGeneratedTeamBriefings(normalized);
  return generated.length
    ? generated
    : teamContentEngine.buildBriefings(normalized, team?.name ?? 'NFL');
}

export function contentSnapshotId(
  teamAbbr: string,
  briefings: Array<{ id: string; updatedAt: string }>,
) {
  const newest = [...briefings].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  return `huddle:${teamAbbr.toUpperCase()}:${newest?.updatedAt ?? 'empty'}:${briefings.length}`;
}
