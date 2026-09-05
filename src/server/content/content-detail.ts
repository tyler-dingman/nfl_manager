import {
  findGeneratedBriefing,
  getGeneratedTeamBriefings,
} from '@/features/content/generated-briefings';
import type { TeamBriefing } from '@/features/content/types';
import { getPublicStoryById, listPublicStories } from '@/server/story-engine/projections';

const toBriefing = (
  story: NonNullable<Awaited<ReturnType<typeof getPublicStoryById>>>,
): TeamBriefing => ({
  id: story.id,
  teamAbbr: story.teamId,
  category: story.storyType,
  headline: story.headline,
  summary: story.shortSummary,
  whyItMatters: story.whyItMatters,
  updatedAt: story.lastMeaningfulUpdateAt,
  sourceCount: story.sources.length,
  status: story.status,
  materialUpdateCount: Math.max(0, story.version - 1),
  firstReportedBy: story.sources.find((source) => source.original)?.name ?? null,
  sources: story.sources.map((source) => ({
    id: source.id,
    kind: source.official ? 'official' : 'reporting',
    publisher: source.name,
    title: story.headline,
    url: source.url,
    publishedAt: source.publishedAt,
  })),
});

export const getContentDetail = async (id: string): Promise<TeamBriefing | null> => {
  const generated = findGeneratedBriefing(id);
  if (generated) return generated;
  try {
    const story = await getPublicStoryById(id);
    if (story) return toBriefing(story);
  } catch (error) {
    console.warn('[content-detail] canonical lookup unavailable', error);
  }
  return null;
};

export async function getRelatedContent(item: TeamBriefing, limit = 3) {
  try {
    const stories = await listPublicStories(item.teamAbbr, limit + 1);
    const related = stories
      .filter((story) => story.id !== item.id)
      .slice(0, limit)
      .map(toBriefing);
    if (related.length) return related;
  } catch {}
  return getGeneratedTeamBriefings(item.teamAbbr)
    .filter((briefing) => briefing.id !== item.id)
    .slice(0, limit);
}
