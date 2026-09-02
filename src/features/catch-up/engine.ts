import { createHash } from 'node:crypto';

import type { ThreeAndOutSnapshot, ThreeAndOutStory } from '@/features/three-and-out/types';
import type { TeamBriefing } from '@/features/content/types';

import type { CatchUpItem, CatchUpStoryState } from './types';

export const CATCH_UP_MAX_ITEMS = 7;
export const CATCH_UP_LONG_ABSENCE_DAYS = 7;
export const VISIT_INACTIVITY_MINUTES = 30;

const meaningfulText = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const fingerprint = (story: ThreeAndOutStory) =>
  createHash('sha256')
    .update(
      [story.status, meaningfulText(story.summary), meaningfulText(story.whyItMatters)].join('|'),
    )
    .digest('hex')
    .slice(0, 20);

export function snapshotStoryStates(snapshot: ThreeAndOutSnapshot): CatchUpStoryState[] {
  const stories = [...snapshot.stories, ...snapshot.puntStories];
  const clustered = new Map<string, ThreeAndOutStory>();
  for (const story of stories) {
    const existing = clustered.get(story.id);
    if (!existing || story.importanceScore > existing.importanceScore)
      clustered.set(story.id, story);
  }
  return [...clustered.values()].map((story) => ({
    id: story.id,
    title: story.title,
    summary: story.summary,
    whyItMatters: story.whyItMatters,
    status: story.status,
    importanceScore: story.importanceScore,
    rank: story.currentRank,
    inThreeAndOut: snapshot.storyIds.includes(story.id),
    lastMaterialUpdateAt: story.lastMaterialUpdateAt,
    sourceCount: story.sourceCount,
    sources: story.sources,
    fingerprint: fingerprint(story),
  }));
}

const isImportantNewStory = (story: CatchUpStoryState) =>
  story.inThreeAndOut || story.status === 'BREAKING' || story.importanceScore >= 60;

const describeChange = (before: CatchUpStoryState, after: CatchUpStoryState) => {
  if (after.status === 'RESOLVED' && before.status !== 'RESOLVED')
    return 'The uncertainty around this story now has a clear outcome.';
  if (!before.inThreeAndOut && after.inThreeAndOut)
    return 'This development moved into the three most important team stories.';
  if (before.status !== after.status)
    return `The story moved from ${before.status.toLowerCase().replace('_', ' ')} to ${after.status.toLowerCase().replace('_', ' ')}.`;
  if (Math.abs(before.rank - after.rank) >= 2)
    return 'Its importance changed significantly as the team picture developed.';
  return 'New material information changed the current understanding of this story.';
};

export function buildCatchUpItems(input: {
  teamId: string;
  baseline: CatchUpStoryState[];
  current: CatchUpStoryState[];
  baselineAt: string;
  now?: Date;
}): { items: CatchUpItem[]; total: number; mode: 'CHANGES' | 'CURRENT_STATE' } {
  const baselineById = new Map(input.baseline.map((story) => [story.id, story]));
  const longAbsence =
    (input.now ?? new Date()).getTime() - new Date(input.baselineAt).getTime() >
    CATCH_UP_LONG_ABSENCE_DAYS * 86_400_000;
  const items: CatchUpItem[] = [];

  for (const story of input.current) {
    const before = baselineById.get(story.id);
    if (!before) {
      if (!isImportantNewStory(story)) continue;
      items.push({
        id: `${story.id}:new`,
        storyId: story.id,
        teamId: input.teamId,
        type: 'NEW',
        headline: story.title,
        summary: story.summary,
        whatChanged: story.inThreeAndOut
          ? 'A new development entered the team’s three most important stories.'
          : 'A meaningful new team story emerged.',
        whyItMatters: story.whyItMatters,
        occurredAt: story.lastMaterialUpdateAt,
        importanceScore: story.importanceScore,
        sourceCount: story.sourceCount,
        sources: story.sources,
        currentStoryStatus: story.status,
      });
      continue;
    }

    const enteredTopThree = !before.inThreeAndOut && story.inThreeAndOut;
    const significantRankMove = Math.abs(before.rank - story.rank) >= 2;
    const statusChanged = before.status !== story.status;
    const semanticChange = before.fingerprint !== story.fingerprint;
    if (!semanticChange && !statusChanged && !enteredTopThree && !significantRankMove) continue;

    const resolved = story.status === 'RESOLVED' && before.status !== 'RESOLVED';
    items.push({
      id: `${story.id}:${resolved ? 'resolved' : 'changed'}`,
      storyId: story.id,
      teamId: input.teamId,
      type: resolved ? 'RESOLVED' : 'CHANGED',
      headline: story.title,
      summary: story.summary,
      whatChanged: describeChange(before, story),
      whyItMatters: story.whyItMatters,
      occurredAt: story.lastMaterialUpdateAt,
      importanceScore: story.importanceScore + (resolved ? 8 : enteredTopThree ? 6 : 0),
      sourceCount: story.sourceCount,
      sources: story.sources,
      currentStoryStatus: story.status,
    });
  }

  const ranked = items.sort(
    (left, right) =>
      right.importanceScore - left.importanceScore ||
      new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime(),
  );
  return {
    items: ranked.slice(0, CATCH_UP_MAX_ITEMS),
    total: ranked.length,
    mode: longAbsence ? 'CURRENT_STATE' : 'CHANGES',
  };
}

export function isNewVisit(lastVisitedAt: string | Date | null, now = new Date()) {
  if (!lastVisitedAt) return true;
  return now.getTime() - new Date(lastVisitedAt).getTime() >= VISIT_INACTIVITY_MINUTES * 60_000;
}

export function isCatchUpEligible(firstVisit: boolean, visitCount: number) {
  return !firstVisit && visitCount >= 2;
}

export function buildContentCatchUpItems(input: {
  teamId: string;
  briefings: TeamBriefing[];
  baselineAt: string;
  consumedVersions: Map<string, string | null>;
}): CatchUpItem[] {
  const baselineTime = new Date(input.baselineAt).getTime();
  return input.briefings
    .filter((briefing) => {
      const updatedTime = new Date(briefing.updatedAt).getTime();
      if (!Number.isFinite(updatedTime) || updatedTime <= baselineTime) return false;
      return input.consumedVersions.get(briefing.id) !== briefing.updatedAt;
    })
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
    .slice(0, CATCH_UP_MAX_ITEMS)
    .map((briefing) => ({
      id: `${briefing.id}:${briefing.updatedAt}`,
      storyId: briefing.id,
      teamId: input.teamId,
      type: 'NEW' as const,
      headline: briefing.headline,
      summary: briefing.summary,
      whatChanged: 'Published since your last Down & Distance session.',
      whyItMatters: briefing.whyItMatters ?? '',
      occurredAt: briefing.updatedAt,
      importanceScore: 100,
      sourceCount: briefing.sourceCount,
      sources: briefing.sources.map((source) => ({
        id: source.id,
        storyId: briefing.id,
        sourceName: source.publisher,
        authorName: null,
        sourceType:
          source.kind === 'official'
            ? ('OFFICIAL' as const)
            : source.kind === 'video'
              ? ('VIDEO' as const)
              : source.kind === 'social'
                ? ('SOCIAL' as const)
                : ('REPORTING' as const),
        sourceUrl: source.url,
        publishedAt: source.publishedAt,
        isOriginalReporter: source.kind === 'reporting',
        isOfficialSource: source.kind === 'official',
      })),
      currentStoryStatus: 'DEVELOPING' as const,
    }));
}
