import { TEAM_LIST } from '@/data/teams';
import type { TeamBriefing } from '@/features/content/types';
import type {
  ThreeAndOutPackage,
  ThreeAndOutSource,
  ThreeAndOutStory,
} from '@/features/three-and-out/types';
import {
  getEditorialOverrides,
  applyEditorialOverrides,
} from '@/features/three-and-out/editorial-store';
import { rankThreeAndOutStories } from '@/features/three-and-out/ranking';
import { listPublicStories, listWireEntries } from '@/server/story-engine/projections';
import { selectHuddleStories } from '@/features/story-engine/surface-selectors';
import { authDb } from '@/server/auth/database';

const sources = (story: any): ThreeAndOutSource[] =>
  story.sources.map((s: any) => ({
    id: s.id,
    storyId: story.id,
    sourceName: s.name,
    authorName: null,
    sourceType: s.official ? 'OFFICIAL' : 'REPORTING',
    sourceUrl: s.url,
    publishedAt: s.publishedAt,
    isOriginalReporter: s.original,
    isOfficialSource: s.official,
  }));
const asThreeStory = (story: any, rank: number): ThreeAndOutStory => ({
  id: story.id,
  teamId: story.teamId,
  title: story.headline,
  shortTitle: story.headline,
  summary: story.whatHappened || story.shortSummary,
  whyItMatters: story.whyItMatters,
  whatsNext: story.whatsNext,
  status: story.status,
  importanceScore: story.importanceScore,
  scoreSignals: {
    footballImpact: story.importanceScore,
    sourceStrength: story.confidenceScore,
    velocity: Math.min(100, story.sources.length * 25),
    freshness: 90,
    fanInterest: story.importanceScore,
    novelty: story.version === 1 ? 90 : 55,
  },
  previousRank: null,
  currentRank: rank,
  createdAt: story.firstReportedAt,
  updatedAt: story.lastMeaningfulUpdateAt,
  firstPublishedAt: story.firstReportedAt,
  lastMaterialUpdateAt: story.lastMeaningfulUpdateAt,
  sourceCount: story.sources.length,
  sources: sources(story),
  newSinceLastVisit: null,
  videoStatus: 'NONE',
  audioStatus: 'NONE',
});
export async function canonicalThreeAndOut(teamId: string): Promise<ThreeAndOutPackage | null> {
  const team = TEAM_LIST.find((t) => t.abbr === teamId);
  if (!team) return null;
  const publicStories = await listPublicStories(teamId, 30);
  if (publicStories.length < 3) return null;
  const candidates = publicStories.map((s, i) => asThreeStory(s, i + 1));
  const ranked = rankThreeAndOutStories(
    applyEditorialOverrides(candidates, getEditorialOverrides(teamId)),
  );
  if (ranked.length < 3) return null;
  ranked.forEach((s, i) => (s.currentRank = i + 1));
  const stories = ranked.slice(0, 3) as [ThreeAndOutStory, ThreeAndOutStory, ThreeAndOutStory];
  const generatedAt = stories
    .map((s) => s.lastMaterialUpdateAt)
    .sort()
    .at(-1)!;
  const id = `canonical:${teamId}:${stories.map((s) => `${s.id}@${publicStories.find((p) => p.id === s.id)?.version}`).join('|')}`;
  await authDb()`INSERT INTO three_and_out_snapshots(id,team_id,story_ids,story_versions,generated_at) VALUES(${id},${teamId},${authDb().json(stories.map((s) => s.id))},${authDb().json(stories.map((s) => publicStories.find((p) => p.id === s.id)?.version ?? 1))},${generatedAt}) ON CONFLICT(id) DO NOTHING`;
  console.info(
    JSON.stringify({
      metric: 'three_and_out_recalculated',
      teamId,
      storyIds: stories.map((s) => s.id),
      snapshotId: id,
    }),
  );
  return {
    current: {
      id,
      teamId,
      teamName: team.name,
      generatedAt,
      storyIds: stories.map((s) => s.id) as [string, string, string],
      stories,
      puntStories: ranked.slice(3),
      fourthDown: {
        id: `${teamId}-fourth-down`,
        teamId,
        question: `Which ${team.name} development matters most right now?`,
        options: [
          { id: 'first', label: stories[0].shortTitle, votes: 0 },
          { id: 'second', label: stories[1].shortTitle, votes: 0 },
        ],
        associatedStoryIds: [stories[0].id, stories[1].id],
      },
      audioStatus: 'NONE',
      audioUrl: null,
      audioDuration: null,
      audioGeneratedAt: null,
      audioScriptVersion: id,
      videoStatus: 'NONE',
      videoUrl: null,
      videoThumbnail: null,
      videoDuration: null,
      videoGeneratedAt: null,
      videoSnapshotId: id,
    },
    previous: [],
  };
}
export async function canonicalHuddle(
  teamId: string,
  excludedIds: string[] = [],
  limit = 4,
): Promise<TeamBriefing[]> {
  const all = await listPublicStories(teamId, 30);
  const selected = selectHuddleStories(all, excludedIds, limit);
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
  const threeAndOut = await canonicalThreeAndOut(teamId);
  const huddle = await canonicalHuddle(teamId, threeAndOut?.current.storyIds ?? [], 4);
  const wire = await listWireEntries(teamId, 6);
  return { teamId, huddle, threeAndOut, wire };
}
