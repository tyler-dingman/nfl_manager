import { NextResponse } from 'next/server';

import { getCuratedFilmRoomVideos } from '@/config/film-room';
import type { FilmRoomResponse } from '@/features/film-room/types';
import { loadYouTubeFilmRoomFallback, loadYouTubeFilmRoomVideos } from '@/server/film-room/youtube';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const teamId = (new URL(request.url).searchParams.get('team') ?? 'NFL').toUpperCase();
  const curated = getCuratedFilmRoomVideos(teamId);
  if (!curated.length) {
    return NextResponse.json<FilmRoomResponse>({
      teamId,
      videos: [],
      unavailableVideoIds: [],
      configured: Boolean(process.env.YOUTUBE_API_KEY),
      message: `Film Room curation is not available for ${teamId} yet.`,
    });
  }

  if (!process.env.YOUTUBE_API_KEY) {
    const videos = await loadYouTubeFilmRoomFallback(curated);
    const loadedIds = new Set(videos.map((video) => video.id));
    return NextResponse.json<FilmRoomResponse>({
      teamId,
      videos,
      unavailableVideoIds: curated
        .map((video) => video.videoId)
        .filter((videoId) => !loadedIds.has(videoId)),
      configured: false,
      message: videos.length
        ? 'Showing YouTube creator metadata. Add YOUTUBE_API_KEY for durations and statistics.'
        : 'Film Room video metadata is temporarily unavailable.',
    });
  }

  try {
    const videos = await loadYouTubeFilmRoomVideos(curated);
    const loadedIds = new Set(videos.map((video) => video.id));
    return NextResponse.json<FilmRoomResponse>({
      teamId,
      videos,
      unavailableVideoIds: curated
        .map((video) => video.videoId)
        .filter((videoId) => !loadedIds.has(videoId)),
      configured: true,
    });
  } catch (error) {
    console.error('[film-room] YouTube metadata request failed', error);
    return NextResponse.json<FilmRoomResponse>(
      {
        teamId,
        videos: [],
        unavailableVideoIds: curated.map((video) => video.videoId),
        configured: true,
        message: 'Film Room video metadata is temporarily unavailable. Please try again soon.',
      },
      { status: 502 },
    );
  }
}
