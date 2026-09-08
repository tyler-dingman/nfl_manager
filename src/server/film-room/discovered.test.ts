import assert from 'node:assert/strict';
import test from 'node:test';

import {
  discoveredRowToFilmRoomVideo,
  filmRoomCategoryForSource,
  type DiscoveredFilmRoomRow,
} from './discovered';

const row: DiscoveredFilmRoomRow = {
  external_id: 'abcdefghijk',
  title: 'Team practice update',
  excerpt: 'The latest from practice.',
  raw_text: '',
  published_at: '2026-09-07T12:00:00.000Z',
  discovered_at: '2026-09-07T12:05:00.000Z',
  author: 'Team Channel',
  source_name: 'Official Team',
  source_url: 'https://www.youtube.com/channel/channel-id',
  source_type: 'OFFICIAL_TEAM',
  reliability_score: '1.000',
  source_metadata: { platform: 'YOUTUBE', category: 'official', youtubeChannelId: 'channel-id' },
};

test('maps discovered YouTube candidates into the Film Room response contract', () => {
  assert.deepEqual(discoveredRowToFilmRoomVideo(row), {
    id: 'abcdefghijk',
    category: 'press-conferences',
    score: 100,
    addedAt: '2026-09-07T12:05:00.000Z',
    title: 'Team practice update',
    description: 'The latest from practice.',
    thumbnail: 'https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg',
    duration: '',
    publishedAt: '2026-09-07T12:00:00.000Z',
    viewCount: null,
    channel: { id: 'channel-id', name: 'Team Channel', avatar: null, subscriberCount: null },
    youtubeUrl: 'https://www.youtube.com/watch?v=abcdefghijk',
    embedUrl: 'https://www.youtube.com/embed/abcdefghijk?autoplay=1&rel=0',
    channelUrl: 'https://www.youtube.com/channel/channel-id',
  });
});

test('categorizes film, podcast, local, official, and creator sources', () => {
  assert.equal(filmRoomCategoryForSource('YOUTUBE', { category: 'film' }), 'film-room');
  assert.equal(filmRoomCategoryForSource('PODCAST', { category: 'podcast' }), 'podcasts');
  assert.equal(filmRoomCategoryForSource('YOUTUBE', { category: 'local_media' }), 'local-shows');
  assert.equal(filmRoomCategoryForSource('OFFICIAL_TEAM', null), 'press-conferences');
  assert.equal(filmRoomCategoryForSource('YOUTUBE', { category: 'creator' }), 'fan-creators');
});

test('rejects malformed YouTube video IDs', () => {
  assert.equal(discoveredRowToFilmRoomVideo({ ...row, external_id: 'not-a-video-id' }), null);
});
