import assert from 'node:assert/strict';
import test from 'node:test';
import { isStoryPublishable, type StoryView } from './public-story';
import { selectHuddleStories, selectWireEvents } from './surface-selectors';
const story = (id: string, type: string, score: number): StoryView => ({
  id,
  teamId: 'KC',
  storyType: type,
  headline: id,
  shortSummary: id,
  whatHappened: id,
  whyItMatters: '',
  whatsNext: '',
  status: 'DEVELOPING',
  importanceScore: score,
  confidenceScore: 95,
  firstReportedAt: '2026-08-31T10:00:00Z',
  lastMeaningfulUpdateAt: '2026-08-31T10:00:00Z',
  sources: [
    {
      id: `${id}-source`,
      name: 'Source',
      url: 'https://example.com',
      publishedAt: '2026-08-31T10:00:00Z',
      official: true,
      original: true,
    },
  ],
  primarySource: null,
  version: 1,
});
test('publishability hides drafts and review stories', () => {
  assert.equal(
    isStoryPublishable({
      publicationState: 'DRAFT',
      confidenceScore: 100,
      status: 'BREAKING',
      sourceCount: 2,
    }),
    false,
  );
  assert.equal(
    isStoryPublishable({
      publicationState: 'REVIEW_REQUIRED',
      confidenceScore: 100,
      status: 'BREAKING',
      sourceCount: 2,
    }),
    false,
  );
  assert.equal(
    isStoryPublishable({
      publicationState: 'PUBLISHED',
      confidenceScore: 95,
      status: 'DEVELOPING',
      sourceCount: 1,
    }),
    true,
  );
});
test('Huddle excludes Three and Out and favors topic diversity', () => {
  const all = [
    story('A', 'TRADE', 99),
    story('B', 'INJURY', 98),
    story('C', 'ROSTER', 97),
    story('D', 'TRADE', 96),
    story('E', 'INJURY', 90),
    story('F', 'PRACTICE', 85),
    story('G', 'COACHING', 80),
  ];
  assert.deepEqual(
    selectHuddleStories(all, ['A', 'B', 'C'], 4).map((s) => s.id),
    ['D', 'E', 'F', 'G'],
  );
});
test('Wire emits one entry per meaningful story version', () => {
  const selected = selectWireEvents([
    {
      id: 'u',
      eventType: 'StoryUpdated',
      storyId: 'A',
      storyVersion: 2,
      occurredAt: '2026-01-01T10:00:00Z',
      payload: {},
    },
    {
      id: 'b',
      eventType: 'StoryBecameBreaking',
      storyId: 'A',
      storyVersion: 2,
      occurredAt: '2026-01-01T10:00:01Z',
      payload: {},
    },
    {
      id: 'i',
      eventType: 'StoryImportanceChanged',
      storyId: 'A',
      storyVersion: 2,
      occurredAt: '2026-01-01T10:00:02Z',
      payload: {},
    },
    {
      id: 'c',
      eventType: 'StoryCreated',
      storyId: 'B',
      storyVersion: 1,
      occurredAt: '2026-01-01T09:00:00Z',
      payload: {},
    },
  ]);
  assert.deepEqual(
    selected.map((e) => e.id),
    ['b', 'c'],
  );
});
