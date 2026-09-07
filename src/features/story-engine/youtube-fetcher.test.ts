import assert from 'node:assert/strict';
import test from 'node:test';
import { YouTubeSourceFetcher } from '@/server/story-engine/fetcher';
import type { RegisteredSource } from './types';

const source: RegisteredSource = {
  id: 'YT_KC_TEST',
  name: 'Test channel',
  sourceType: 'YOUTUBE',
  teamId: 'KC',
  leagueWide: false,
  url: 'https://www.youtube.com/channel/test',
  feedUrl: null,
  fetchStrategy: 'STRUCTURED_API',
  pollingTier: 'B',
  priority: 85,
  reliabilityScore: 0.85,
  checkIntervalSeconds: 14_400,
  enabled: true,
  etag: null,
  lastModified: null,
  lastCheckedAt: null,
  lastSuccessfulAt: null,
  nextCheckAt: new Date(),
  failureCount: 0,
  lastError: null,
  metadata: {
    platform: 'YOUTUBE',
    youtubeChannelId: 'channel-id',
    youtubeUploadsPlaylistId: 'uploads-id',
  },
};

test('YouTube polling uses the low-cost uploads playlist endpoint', async () => {
  const priorKey = process.env.YOUTUBE_API_KEY;
  const priorFetch = global.fetch;
  process.env.YOUTUBE_API_KEY = 'test-key';
  let requested = '';
  global.fetch = (async (input: URL | RequestInfo) => {
    requested = String(input);
    return new Response(
      JSON.stringify({
        items: [
          {
            contentDetails: { videoId: 'video-1' },
            snippet: {
              title: 'Chiefs film review',
              description: 'Kansas City Chiefs analysis',
              channelTitle: 'Test channel',
              publishedAt: '2026-09-07T12:00:00Z',
            },
          },
        ],
      }),
      { status: 200 },
    );
  }) as typeof fetch;
  try {
    const result = await new YouTubeSourceFetcher().fetch(source);
    assert.match(requested, /youtube\/v3\/playlistItems/);
    assert.match(requested, /playlistId=uploads-id/);
    assert.doesNotMatch(requested, /youtube\/v3\/search/);
    assert.equal(result.items[0]?.externalId, 'video-1');
  } finally {
    global.fetch = priorFetch;
    if (priorKey === undefined) delete process.env.YOUTUBE_API_KEY;
    else process.env.YOUTUBE_API_KEY = priorKey;
  }
});
