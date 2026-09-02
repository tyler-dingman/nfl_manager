import {
  selectHuddleStories,
  selectWireEvents,
} from '../src/features/story-engine/surface-selectors';
import type { StoryView } from '../src/features/story-engine/public-story';
const make = (
  id: string,
  type: string,
  score: number,
  status: StoryView['status'] = 'DEVELOPING',
): StoryView => ({
  id,
  teamId: 'KC',
  storyType: type,
  headline: `Story ${id}`,
  shortSummary: `Current summary for ${id}`,
  whatHappened: `What happened in ${id}`,
  whyItMatters: `Why ${id} matters`,
  whatsNext: 'Watch for the next confirmed development.',
  status,
  importanceScore: score,
  confidenceScore: 95,
  firstReportedAt: '2026-08-31T10:00:00Z',
  lastMeaningfulUpdateAt: '2026-08-31T10:00:00Z',
  sources: [
    {
      id: `source-${id}`,
      name: 'Fixture source',
      url: `https://example.com/${id}`,
      publishedAt: '2026-08-31T10:00:00Z',
      official: true,
      original: true,
    },
  ],
  primarySource: null,
  version: 1,
});
let stories = [
  make('A', 'TRADE', 99),
  make('B', 'INJURY', 96),
  make('C', 'ROSTER', 92),
  make('D', 'PRACTICE', 80),
  make('E', 'COACHING', 76),
  make('F', 'CONTRACT', 72),
  make('G', 'DRAFT', 68),
];
let top = stories.slice(0, 3);
console.log(
  'INITIAL 3 & Out',
  top.map((s) => s.id),
);
console.log(
  'INITIAL Huddle',
  selectHuddleStories(
    stories,
    top.map((s) => s.id),
    4,
  ).map((s) => s.id),
);
let events = stories.map((s, i) => ({
  id: `created-${s.id}`,
  eventType: 'StoryCreated',
  storyId: s.id,
  storyVersion: 1,
  occurredAt: `2026-08-31T10:0${i}:00Z`,
  payload: {},
}));
console.log(
  'INITIAL Wire',
  selectWireEvents(events).map((e) => e.storyId),
);
stories = stories
  .map((s) =>
    s.id === 'D'
      ? {
          ...s,
          status: 'BREAKING' as const,
          importanceScore: 100,
          version: 2,
          lastMeaningfulUpdateAt: '2026-08-31T11:00:00Z',
        }
      : s,
  )
  .sort((a, b) => b.importanceScore - a.importanceScore);
top = stories.slice(0, 3);
events.push({
  id: 'breaking-D',
  eventType: 'StoryBecameBreaking',
  storyId: 'D',
  storyVersion: 2,
  occurredAt: '2026-08-31T11:00:00Z',
  payload: {},
});
console.log(
  'D BREAKING -> 3 & Out',
  top.map((s) => s.id),
  'Huddle',
  selectHuddleStories(
    stories,
    top.map((s) => s.id),
    4,
  ).map((s) => s.id),
  'Wire first',
  selectWireEvents(events)[0].id,
  'Catch Up CHANGED D',
);
stories = stories.map((s) =>
  s.id === 'A' ? { ...s, status: 'RESOLVED' as const, version: 2 } : s,
);
events.push({
  id: 'resolved-A',
  eventType: 'StoryResolved',
  storyId: 'A',
  storyVersion: 2,
  occurredAt: '2026-08-31T12:00:00Z',
  payload: {},
});
console.log('A RESOLVED -> Wire first', selectWireEvents(events)[0].id, 'Catch Up RESOLVED A');
