import type { CatchUpItem } from '@/features/catch-up/types';

export type ThreeOutNarrationSegment = {
  storyId: string;
  label: string;
  headline: string;
  script: string;
};

export type ThreeOutNarration = {
  id: string;
  teamId: string;
  segments: [ThreeOutNarrationSegment, ThreeOutNarrationSegment, ThreeOutNarrationSegment];
  estimatedSeconds: number;
};
const clean = (value: string) => value.replace(/\s+/g, ' ').trim();
const limitWords = (value: string, maximum: number) => {
  const words = clean(value).split(/\s+/).filter(Boolean);
  return words.length <= maximum ? words.join(' ') : `${words.slice(0, maximum).join(' ')}…`;
};

export function selectThreeOutCatchUpStories(items: CatchUpItem[]) {
  const canonical = new Map<string, CatchUpItem>();
  for (const item of items) {
    const existing = canonical.get(item.storyId);
    if (
      !existing ||
      item.importanceScore > existing.importanceScore ||
      (item.importanceScore === existing.importanceScore &&
        new Date(item.occurredAt).getTime() > new Date(existing.occurredAt).getTime())
    )
      canonical.set(item.storyId, item);
  }
  return [...canonical.values()]
    .sort(
      (left, right) =>
        right.importanceScore - left.importanceScore ||
        new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime(),
    )
    .slice(0, 3);
}

const labelFor = (item: CatchUpItem) =>
  item.currentStoryStatus === 'BREAKING'
    ? 'Breaking'
    : item.type === 'CHANGED'
      ? 'What Changed'
      : item.type === 'RESOLVED'
        ? 'Resolved'
        : 'Team Update';

export function buildThreeOutNarration(
  teamId: string,
  teamName: string,
  items: CatchUpItem[],
): ThreeOutNarration | null {
  const stories = selectThreeOutCatchUpStories(items);
  if (stories.length < 3) return null;
  const transitions = [
    `Alright, here’s your ${teamName} Three and Out. First up,`,
    'Next one,',
    'And finally,',
  ];
  const segments = stories.map((story, index) => {
    const context = limitWords(story.summary, 24);
    const meaning = limitWords(story.whyItMatters, 14);
    const closing = index === 2 ? ` That’s your Three and Out. You’re caught up.` : '';
    return {
      storyId: story.storyId,
      label: labelFor(story),
      headline: story.headline,
      script: clean(
        `${transitions[index]} ${story.headline}. ${context}${meaning ? ` Why it matters: ${meaning}` : ''}${closing}`,
      ),
    };
  }) as ThreeOutNarration['segments'];
  const words = segments.reduce((total, segment) => total + segment.script.split(/\s+/).length, 0);
  return {
    id: `${teamId}:${stories.map((story) => story.id).join('|')}`,
    teamId,
    segments,
    estimatedSeconds: Math.max(1, Math.round((words / 155) * 60)),
  };
}

export type ThreeOutPlayback =
  | { status: 'IDLE'; activeIndex: 0 }
  | { status: 'PLAYING' | 'PAUSED'; activeIndex: 0 | 1 | 2 }
  | { status: 'COMPLETE'; activeIndex: null }
  | { status: 'ERROR'; activeIndex: null };

export function nextThreeOutPlayback(index: 0 | 1 | 2): ThreeOutPlayback {
  return index === 2
    ? { status: 'COMPLETE', activeIndex: null }
    : { status: 'PLAYING', activeIndex: (index + 1) as 1 | 2 };
}
