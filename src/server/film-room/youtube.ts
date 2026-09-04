import { unstable_cache } from 'next/cache';

import type { CuratedFilmRoomVideo, FilmRoomVideo } from '@/features/film-room/types';

type YouTubeVideoItem = {
  id: string;
  snippet?: {
    title?: string;
    description?: string;
    channelId?: string;
    channelTitle?: string;
    publishedAt?: string;
    thumbnails?: Record<string, { url?: string }>;
  };
  contentDetails?: { duration?: string };
  statistics?: { viewCount?: string };
};

type YouTubeChannelItem = {
  id: string;
  snippet?: { title?: string; thumbnails?: Record<string, { url?: string }> };
  statistics?: { subscriberCount?: string; hiddenSubscriberCount?: boolean };
};

type YouTubeListResponse<T> = { items?: T[]; error?: { message?: string } };

type YouTubeOEmbedResponse = {
  title?: string;
  author_name?: string;
  author_url?: string;
  thumbnail_url?: string;
};

function bestThumbnail(thumbnails?: Record<string, { url?: string }>) {
  return (
    thumbnails?.maxres?.url ??
    thumbnails?.standard?.url ??
    thumbnails?.high?.url ??
    thumbnails?.medium?.url ??
    thumbnails?.default?.url ??
    null
  );
}

function formatIsoDuration(value = '') {
  const match = value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return '';
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  return hours
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function safeCount(value?: string) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function youtubeGet<T>(resource: string, params: Record<string, string>) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) throw new Error('YOUTUBE_API_KEY is not configured.');

  const url = new URL(`https://www.googleapis.com/youtube/v3/${resource}`);
  Object.entries({ ...params, key: apiKey }).forEach(([key, value]) =>
    url.searchParams.set(key, value),
  );
  const response = await fetch(url, { cache: 'no-store' });
  const payload = (await response.json()) as YouTubeListResponse<T>;
  if (!response.ok)
    throw new Error(payload.error?.message ?? `YouTube API returned ${response.status}.`);
  return payload.items ?? [];
}

const fetchYouTubeMetadata = unstable_cache(
  async (curated: CuratedFilmRoomVideo[]): Promise<FilmRoomVideo[]> => {
    if (!curated.length) return [];
    const videoItems = await youtubeGet<YouTubeVideoItem>('videos', {
      part: 'snippet,contentDetails,statistics',
      id: curated.map((video) => video.videoId).join(','),
    });
    const channelIds = Array.from(
      new Set(videoItems.map((video) => video.snippet?.channelId).filter(Boolean)),
    ) as string[];
    const channelItems = channelIds.length
      ? await youtubeGet<YouTubeChannelItem>('channels', {
          part: 'snippet,statistics',
          id: channelIds.join(','),
        })
      : [];
    const channels = new Map(channelItems.map((channel) => [channel.id, channel]));
    const editorial = new Map(curated.map((video) => [video.videoId, video]));

    return videoItems.flatMap((video) => {
      const input = editorial.get(video.id);
      const snippet = video.snippet;
      const thumbnail = bestThumbnail(snippet?.thumbnails);
      const channelId = snippet?.channelId;
      if (!input || !snippet?.title || !snippet.publishedAt || !thumbnail || !channelId) return [];
      const channel = channels.get(channelId);
      const subscriberCount = channel?.statistics?.hiddenSubscriberCount
        ? null
        : safeCount(channel?.statistics?.subscriberCount);

      return [
        {
          id: video.id,
          category: input.category,
          score: input.score,
          addedAt: input.addedAt,
          title: snippet.title,
          description: snippet.description?.trim() || null,
          thumbnail,
          duration: formatIsoDuration(video.contentDetails?.duration),
          publishedAt: snippet.publishedAt,
          viewCount: safeCount(video.statistics?.viewCount),
          channel: {
            id: channelId,
            name: channel?.snippet?.title ?? snippet.channelTitle ?? 'YouTube creator',
            avatar: bestThumbnail(channel?.snippet?.thumbnails),
            subscriberCount,
          },
          youtubeUrl: `https://www.youtube.com/watch?v=${video.id}`,
          embedUrl: `https://www.youtube.com/embed/${video.id}?autoplay=1&rel=0`,
          channelUrl: `https://www.youtube.com/channel/${channelId}`,
        },
      ];
    });
  },
  ['film-room-youtube-metadata-v2'],
  { revalidate: 3600 },
);

export async function loadYouTubeFilmRoomVideos(curated: CuratedFilmRoomVideo[]) {
  return fetchYouTubeMetadata([...curated]);
}

const fetchYouTubeOEmbedMetadata = unstable_cache(
  async (curated: CuratedFilmRoomVideo[]): Promise<FilmRoomVideo[]> => {
    const videos: Array<FilmRoomVideo | null> = await Promise.all(
      curated.map(async (input) => {
        try {
          const url = new URL('https://www.youtube.com/oembed');
          url.searchParams.set('url', `https://www.youtube.com/watch?v=${input.videoId}`);
          url.searchParams.set('format', 'json');
          const response = await fetch(url, { cache: 'no-store' });
          if (!response.ok) return null;
          const metadata = (await response.json()) as YouTubeOEmbedResponse;
          if (!metadata.title || !metadata.thumbnail_url || !metadata.author_name) return null;
          return {
            id: input.videoId,
            category: input.category,
            score: input.score,
            addedAt: input.addedAt,
            title: metadata.title,
            description: null,
            thumbnail: metadata.thumbnail_url,
            duration: '',
            publishedAt: null,
            viewCount: null,
            channel: {
              id: metadata.author_url ?? '',
              name: metadata.author_name,
              avatar: null,
              subscriberCount: null,
            },
            youtubeUrl: `https://www.youtube.com/watch?v=${input.videoId}`,
            embedUrl: `https://www.youtube.com/embed/${input.videoId}?autoplay=1&rel=0`,
            channelUrl: metadata.author_url ?? 'https://www.youtube.com/',
          } satisfies FilmRoomVideo;
        } catch {
          return null;
        }
      }),
    );
    return videos.filter((video): video is FilmRoomVideo => video !== null);
  },
  ['film-room-youtube-oembed-v1'],
  { revalidate: 3600 },
);

export async function loadYouTubeFilmRoomFallback(curated: CuratedFilmRoomVideo[]) {
  return fetchYouTubeOEmbedMetadata([...curated]);
}
