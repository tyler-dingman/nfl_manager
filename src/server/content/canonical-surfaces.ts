import type { TeamBriefing } from '@/features/content/types';
import type { ThreeAndOutPackage } from '@/features/three-and-out/types';
import { listPublicStories, listWireEntries } from '@/server/story-engine/projections';
import { selectHuddleStories } from '@/features/story-engine/surface-selectors';
import { loadTeamBriefings } from '@/server/content/team-briefings';
import {
  generateDailyThreeAndOut,
  getDailyThreeAndOut,
} from '@/server/three-and-out/daily-service';

export async function canonicalThreeAndOut(
  teamId: string,
  briefingDate?: string,
): Promise<ThreeAndOutPackage | null> {
  return (await getDailyThreeAndOut(teamId, briefingDate)) ?? generateDailyThreeAndOut(teamId);
}
export async function canonicalHuddle(
  teamId: string,
  excludedIds: string[] = [],
  limit = 4,
  order: 'RANKED' | 'LATEST' = 'RANKED',
): Promise<TeamBriefing[]> {
  const all = await listPublicStories(teamId, Math.max(30, limit));
  const selected =
    order === 'LATEST'
      ? [...all]
          .sort(
            (left, right) =>
              new Date(right.lastMeaningfulUpdateAt).getTime() -
              new Date(left.lastMeaningfulUpdateAt).getTime(),
          )
          .slice(0, limit)
      : selectHuddleStories(all, excludedIds, limit);
  const result = [];
  for (const s of selected) {
    if (result.length >= limit) break;
    result.push({
      id: s.id,
      teamAbbr: s.teamId,
      headline: s.headline,
      summary: s.shortSummary,
      whyItMatters: s.whyItMatters,
      category: s.storyType,
      updatedAt: s.lastMeaningfulUpdateAt,
      sourceCount: s.sources.length,
      status: s.status,
      materialUpdateCount: Math.max(0, s.version - 1),
      hotReadUntil: s.hotReadUntil ?? null,
      firstReportedBy: s.sources.find((x) => x.original)?.name ?? null,
      sources: s.sources.map((x) => ({
        id: x.id,
        publisher: x.name,
        title: s.headline,
        url: x.url,
        publishedAt: x.publishedAt,
        kind: x.official ? 'official' : 'reporting',
      })),
    } as TeamBriefing);
  }
  return result;
}
export async function getTeamHomepageData(teamId: string) {
  // Homepage surfaces must fail independently. A missing daily briefing or Wire query should
  // never blank the primary Beat feed.
  const [canonicalResult, fallbackResult, threeAndOutResult, wireResult] = await Promise.allSettled(
    [
      canonicalHuddle(teamId, [], 4, 'LATEST'),
      loadTeamBriefings(teamId),
      canonicalThreeAndOut(teamId),
      listWireEntries(teamId, 6),
    ],
  );
  const canonical = canonicalResult.status === 'fulfilled' ? canonicalResult.value : [];
  const fallback = fallbackResult.status === 'fulfilled' ? fallbackResult.value : [];
  const huddle = (canonical.length ? canonical : fallback)
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
    .slice(0, 4);
  const threeAndOut = threeAndOutResult.status === 'fulfilled' ? threeAndOutResult.value : null;
  const wire = wireResult.status === 'fulfilled' ? wireResult.value : [];
  return { teamId, huddle, threeAndOut, wire };
}
