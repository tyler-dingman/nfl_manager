import type { ThreeAndOutStory } from './types';

export const THREE_AND_OUT_COUNT = 3;
export const THREE_AND_OUT_PUBLISH_HOUR = 17;

const categoryFor = (story: ThreeAndOutStory) => {
  const value = `${story.category ?? ''} ${story.title}`.toLowerCase();
  if (/injur|questionable|out\b|practice report/.test(value)) return 'Injury update';
  if (/trade|sign|release|waiv|roster|contract/.test(value)) return 'Roster move';
  if (/game|preview|matchup|schedule|kickoff/.test(value)) return 'Game update';
  if (/coach|coordinator|staff/.test(value)) return 'Coaching';
  if (/draft|rookie|prospect/.test(value)) return 'Draft';
  return 'Team news';
};

export const normalizeBriefingHeadline = (value: string) =>
  value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(the|a|an|and|or|of|to|for|in|on|at|with|latest|update|report)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const overlap = (left: string, right: string) => {
  const a = new Set(normalizeBriefingHeadline(left).split(' ').filter(Boolean));
  const b = new Set(normalizeBriefingHeadline(right).split(' ').filter(Boolean));
  if (!a.size || !b.size) return 0;
  const shared = [...a].filter((token) => b.has(token)).length;
  return shared / Math.min(a.size, b.size);
};

export const briefingStoryScore = (story: ThreeAndOutStory, now = new Date()) => {
  const ageHours = Math.max(
    0,
    (now.getTime() - new Date(story.lastMaterialUpdateAt).getTime()) / 3_600_000,
  );
  const freshness = Math.max(0, 30 - ageHours * 1.25);
  const authority = story.sources.some((source) => source.isOfficialSource) ? 12 : 0;
  const corroboration = Math.min(15, Math.max(0, story.sourceCount - 1) * 5);
  const breaking = story.status === 'BREAKING' ? 18 : story.status === 'DEVELOPING' ? 8 : 0;
  return story.importanceScore + freshness + authority + corroboration + breaking;
};

/** Deterministic top-three selection with duplicate suppression and category diversity. */
export function selectDailyBriefingStories(
  candidates: ThreeAndOutStory[],
  teamId: string,
  now = new Date(),
) {
  const ranked = candidates
    .filter((story) => story.teamId === teamId)
    .filter((story) => Number.isFinite(new Date(story.lastMaterialUpdateAt).getTime()))
    .sort((left, right) => {
      const difference = briefingStoryScore(right, now) - briefingStoryScore(left, now);
      return difference || left.id.localeCompare(right.id);
    });
  const deduped = ranked.filter(
    (story, index, all) =>
      all.findIndex(
        (candidate) => candidate.id === story.id || overlap(candidate.title, story.title) >= 0.72,
      ) === index,
  );
  const selected: ThreeAndOutStory[] = [];
  for (const story of deduped) {
    if (selected.length >= THREE_AND_OUT_COUNT) break;
    if (selected.some((item) => categoryFor(item) === categoryFor(story))) continue;
    selected.push(story);
  }
  for (const story of deduped) {
    if (selected.length >= THREE_AND_OUT_COUNT) break;
    if (!selected.some((item) => item.id === story.id)) selected.push(story);
  }
  return selected.map((story, index) => ({
    ...story,
    category: categoryFor(story),
    currentRank: index + 1,
    destinationUrl:
      story.destinationUrl ?? story.sources[0]?.sourceUrl ?? `/the-beat?team=${teamId}`,
    audioStatus: 'DISABLED' as const,
  }));
}

export const dateInTimezone = (date: Date, timeZone: string) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);

export const localHourAndMinute = (date: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  return {
    hour: Number(parts.find((part) => part.type === 'hour')?.value ?? -1),
    minute: Number(parts.find((part) => part.type === 'minute')?.value ?? -1),
  };
};

export const isDailyBriefingDeliveryDue = (date: Date, timeZone: string) => {
  const { hour, minute } = localHourAndMinute(date, timeZone);
  return hour === THREE_AND_OUT_PUBLISH_HOUR && minute < 20;
};

export function buildDailyBriefingPush(input: {
  teamId: string;
  teamName: string;
  briefingDate: string;
  stories: ThreeAndOutStory[];
}) {
  const categories = [...new Set(input.stories.map(categoryFor))].slice(0, 3);
  return {
    title: `Three & Out: ${input.teamName}`,
    body: categories.length
      ? `Your 5 PM briefing: ${categories.join(' · ')}`
      : 'Your daily team briefing is ready.',
    destination: `/three-and-out?team=${encodeURIComponent(input.teamId)}&date=${input.briefingDate}`,
  };
}
