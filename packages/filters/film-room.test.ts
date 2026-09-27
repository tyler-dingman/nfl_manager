import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FILM_ROOM_CATEGORIES,
  FILM_ROOM_FILTERS,
  filterFilmVideos,
  filmPublishedLabel,
} from './film-room';
const videos = [
  { id: 'a', category: 'film-room', publishedAt: '2026-09-01', viewCount: 10 },
  { id: 'b', category: 'podcasts', publishedAt: null, addedAt: '2026-09-03', viewCount: 20 },
  { id: 'c', category: 'film-room', publishedAt: '2026-09-02', viewCount: null },
];
test('Film Room uses actual categories and existing sorts on both platforms', () => {
  assert.equal(FILM_ROOM_CATEGORIES.length, 7);
  assert.deepEqual(
    FILM_ROOM_FILTERS[1].options.map((o) => o.value),
    ['newest', 'oldest', 'most-viewed'],
  );
  assert.ok(!FILM_ROOM_CATEGORIES.some((c) => String(c.id) === 'highlights'));
});
test('category filtering and sort use dates, fallback dates, and view counts without mutating inputs', () => {
  assert.deepEqual(
    filterFilmVideos(videos, 'all', 'newest').map((v) => v.id),
    ['b', 'c', 'a'],
  );
  assert.deepEqual(
    filterFilmVideos(videos, 'film-room', 'oldest').map((v) => v.id),
    ['a', 'c'],
  );
  assert.deepEqual(
    filterFilmVideos(videos, 'all', 'most-viewed').map((v) => v.id),
    ['b', 'a', 'c'],
  );
  assert.deepEqual(
    videos.map((v) => v.id),
    ['a', 'b', 'c'],
  );
  assert.equal(filmPublishedLabel('bad'), '');
});
