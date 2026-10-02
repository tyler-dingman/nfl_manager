import assert from 'node:assert/strict';
import test from 'node:test';
import { selectBeatHeroStories, selectFilmHeroVideos } from './editorial-stories';

test('Beat prioritizes new changes, deduplicates them, and fills remaining slots with current stories', () => {
  const current = ['a', 'b', 'c'].map((id) => ({
    id,
    headline: id,
    updatedAt: '2026-09-27',
    sourceCount: 1,
  }));
  const result = selectBeatHeroStories(current, {
    eligible: true,
    mode: 'CHANGES',
    items: [
      { storyId: 'a', headline: 'New a', sourceCount: 2, importanceScore: 1 },
      { storyId: 'b', headline: 'New b', sourceCount: 3, importanceScore: 10 },
      { storyId: 'b', headline: 'Duplicate b', sourceCount: 3, importanceScore: 5 },
    ],
  });
  assert.deepEqual(
    result.map((item) => item.id),
    ['b', 'a', 'c'],
  );
  assert.equal(result[0].briefing, current[1]);
  assert.equal(result[2].isNew, false);
  assert.equal(
    selectBeatHeroStories(current, { eligible: false, mode: 'CHANGES', items: [] })[0].id,
    'a',
  );
});
test('Film ranking handles absent dates and scores without mutating the feed order', () => {
  const videos = [
    { id: 'undated', publishedAt: null },
    { id: 'recent', publishedAt: '2026-09-27', score: 3 },
    { id: 'ranked', publishedAt: '2026-09-01', score: 10 },
    { id: 'older', publishedAt: '2026-09-20', score: 3 },
  ];
  assert.deepEqual(
    selectFilmHeroVideos(videos).map((video) => video.id),
    ['ranked', 'recent', 'older'],
  );
  assert.equal(videos[0].id, 'undated');
  assert.deepEqual(selectFilmHeroVideos([]), []);
});
