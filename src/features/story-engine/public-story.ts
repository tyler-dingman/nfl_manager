import type { PublicationState, StoryRecord } from './types';

export type StorySourceView = {
  id: string;
  name: string;
  url: string;
  publishedAt: string;
  official: boolean;
  original: boolean;
};
export type StoryView = {
  id: string;
  teamId: string;
  storyType: string;
  headline: string;
  shortSummary: string;
  whatHappened: string;
  whyItMatters: string;
  whatsNext: string;
  status: StoryRecord['status'];
  importanceScore: number;
  confidenceScore: number;
  firstReportedAt: string;
  lastMeaningfulUpdateAt: string;
  sources: StorySourceView[];
  primarySource: StorySourceView | null;
  version: number;
};
export type PublishableStory = Pick<
  StoryRecord,
  'publicationState' | 'confidenceScore' | 'status'
> & { sourceCount: number };

export function isStoryPublishable(story: PublishableStory) {
  return (
    ['PUBLISHED', 'AUTO_PUBLISHED'].includes(story.publicationState as PublicationState) &&
    story.confidenceScore >= 80 &&
    story.sourceCount > 0 &&
    story.status !== 'HOLDING'
  );
}
export function selectPrimarySource(sources: StorySourceView[]) {
  return (
    [...sources].sort(
      (a, b) =>
        Number(b.official) - Number(a.official) ||
        Number(b.original) - Number(a.original) ||
        b.publishedAt.localeCompare(a.publishedAt),
    )[0] ?? null
  );
}
