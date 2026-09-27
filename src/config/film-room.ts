import type { CuratedFilmRoomVideo } from '@/features/film-room/types';

export { FILM_ROOM_CATEGORIES } from '../../packages/filters/film-room';

// Editorial inputs are intentionally separate from YouTube metadata. An automated
// curation process can replace this list later without changing the Film Room UI.
export const CURATED_FILM_ROOM_VIDEOS: ReadonlyArray<CuratedFilmRoomVideo> = [
  {
    teamId: 'KC',
    videoId: 'Ij1R4bGhm24',
    category: 'press-conferences',
    score: 100,
    addedAt: '2026-09-02T12:00:00.000Z',
  },
  {
    teamId: 'KC',
    videoId: 'aI9o4ptwoGE',
    category: 'film-room',
    score: 95,
    addedAt: '2026-09-02T11:00:00.000Z',
  },
  {
    teamId: 'KC',
    videoId: 'HsD-32oHYtg',
    category: 'local-shows',
    score: 90,
    addedAt: '2026-09-02T10:00:00.000Z',
  },
  {
    teamId: 'KC',
    videoId: '2m4Y1Xqx1UM',
    category: 'player-interviews',
    score: 85,
    addedAt: '2026-09-02T09:00:00.000Z',
  },
  {
    teamId: 'KC',
    videoId: 'tIs8QPKr9eU',
    category: 'podcasts',
    score: 80,
    addedAt: '2026-09-02T08:00:00.000Z',
  },
  {
    teamId: 'KC',
    videoId: 'Iy2zYfQLEjY',
    category: 'fan-creators',
    score: 75,
    addedAt: '2026-09-02T07:00:00.000Z',
  },
];

export function getCuratedFilmRoomVideos(teamId: string) {
  return CURATED_FILM_ROOM_VIDEOS.filter((video) => video.teamId === teamId.toUpperCase());
}
