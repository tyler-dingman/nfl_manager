import { NextResponse } from 'next/server';

import { getCuratedFilmRoomVideos } from '@/config/film-room';
import type { FilmRoomResponse, FilmRoomVideo } from '@/features/film-room/types';
import { loadDiscoveredFilmRoomVideos } from '@/server/film-room/discovered';
import { loadYouTubeFilmRoomFallback, loadYouTubeFilmRoomVideos } from '@/server/film-room/youtube';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const teamId = (new URL(request.url).searchParams.get('team') ?? 'NFL').toUpperCase();
  let discovered: FilmRoomVideo[] = [];
  let discoveryUnavailable = false;
  try {
    discovered = await loadDiscoveredFilmRoomVideos(teamId);
  } catch (error) {
    discoveryUnavailable = true;
    console.error('[film-room] Stored video lookup failed', error);
  }

  const discoveredIds = new Set(discovered.map((video) => video.id));
  const curated = getCuratedFilmRoomVideos(teamId).filter(
    (video) => !discoveredIds.has(video.videoId),
  );

  let curatedVideos: FilmRoomVideo[] = [];
  if (curated.length) {
    try {
      curatedVideos = process.env.YOUTUBE_API_KEY
        ? await loadYouTubeFilmRoomVideos(curated)
        : await loadYouTubeFilmRoomFallback(curated);
    } catch (error) {
      console.error('[film-room] YouTube metadata request failed', error);
    }
  }

  const videos = [...discovered, ...curatedVideos].sort(
    (left, right) =>
      new Date(right.publishedAt ?? right.addedAt).getTime() -
      new Date(left.publishedAt ?? left.addedAt).getTime(),
  );
  const loadedIds = new Set(videos.map((video) => video.id));
  const unavailableVideoIds = curated
    .map((video) => video.videoId)
    .filter((videoId) => !loadedIds.has(videoId));

  return NextResponse.json<FilmRoomResponse>({
    teamId,
    videos,
    unavailableVideoIds,
    configured: Boolean(process.env.YOUTUBE_API_KEY),
    message: discoveryUnavailable
      ? videos.length
        ? 'Showing editorial Film Room videos while newly discovered videos are temporarily unavailable.'
        : 'Film Room videos are temporarily unavailable. Please try again soon.'
      : videos.length
        ? undefined
        : `No ${teamId} videos have been discovered yet.`,
  });
}
