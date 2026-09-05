import type { MetadataRoute } from 'next';
import { TEAM_LIST } from '@/data/teams';
import { getGeneratedTeamBriefings } from '@/features/content/generated-briefings';
import { listPublicStories } from '@/server/story-engine/projections';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.downdistance.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes = [
    '',
    '/the-beat',
    '/film-room',
    '/front-office',
    '/game-day',
    '/trivia',
    '/merch',
  ];
  const generated = TEAM_LIST.flatMap((team) => getGeneratedTeamBriefings(team.abbr));
  const canonical = (
    await Promise.all(
      TEAM_LIST.map(async (team) => {
        try {
          return await listPublicStories(team.abbr, 1000);
        } catch {
          return [];
        }
      }),
    )
  ).flat();
  const unique = new Map([...generated, ...canonical].map((item) => [item.id, item]));
  const content = [...unique.values()].map((item) => ({
    url: `${siteUrl}/content/${encodeURIComponent(item.id)}`,
    lastModified: new Date('updatedAt' in item ? item.updatedAt : item.lastMeaningfulUpdateAt),
    changeFrequency: 'hourly' as const,
    priority: 0.8,
  }));
  return [
    ...staticRoutes.map((path) => ({
      url: `${siteUrl}${path}`,
      changeFrequency: 'daily' as const,
      priority: path ? 0.7 : 1,
    })),
    ...content,
  ];
}
