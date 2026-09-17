import seed from '@/data/front-office/2026-week-1-news.json';
import type { FrontOfficeEvent, FrontOfficeEventPriority } from '@/types/front-office';
import type { NewFrontOfficeEvent } from './events-repository';

export const FRONT_OFFICE_2026_SEED = seed;

export type RealWorldSeedStory = (typeof seed.stories)[number];

const eventTypeFor = (story: RealWorldSeedStory): FrontOfficeEvent['type'] => {
  if (story.storyType === 'RUMOR') return 'trade_rumor';
  if (story.storyType === 'CONTRACT') return 'contract_extension';
  if (story.tags.includes('SIGNING')) return 'free_agent_signing';
  if (story.tags.includes('RELEASE')) return 'player_release';
  return story.storyType === 'ANALYSIS' ? 'breaking_news' : 'league_transaction';
};

const priorityFor = (score: number): FrontOfficeEventPriority =>
  score >= 90 ? 'urgent' : score >= 78 ? 'high' : score >= 50 ? 'normal' : 'low';

export function realWorldSeedEvents(saveId: string, season: number): NewFrontOfficeEvent[] {
  if (season !== seed.season) return [];
  return seed.stories.map((story) => ({
    // Event IDs are unique per user, while seed stories are copied into every
    // franchise save. Include the save ID so a user's second franchise does
    // not collide with events already created for their first franchise.
    id: `seed_${saveId}_${story.id}`,
    saveId,
    dedupeKey: `real-world-seed:${story.id}`,
    type: eventTypeFor(story),
    priority: priorityFor(story.importanceScore),
    headline: story.headline,
    summary: story.summary,
    teamAbbr: story.teamIds[0] ?? null,
    relatedTeamAbbr: story.teamIds[1] ?? null,
    playerId: null,
    prospectId: null,
    tradeOfferId: null,
    simulationSeason: seed.season,
    simulationWeek: 1,
    simulationPhase: 'preseason',
    actionUrl: null,
    metadata: {
      origin: 'REAL_WORLD_SEED',
      seedCutoff: seed.cutoff,
      teamIds: story.teamIds,
      newsCategory: story.storyType,
      tags: story.tags,
      importanceScore: story.importanceScore,
      confidenceScore: story.confidenceScore,
      sourcePublisher: story.source.publisher,
      sourceTitle: story.source.title,
      sourceUrl: story.source.url,
      sourceTier: story.source.tier,
      sourcePublishedAt: story.publishedAt,
    },
    expiresAt: null,
  }));
}
