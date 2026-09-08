import { authDb } from '@/server/auth/database';
import type { FilmRoomCategory, FilmRoomVideo } from '@/features/film-room/types';

export type DiscoveredFilmRoomRow = {
  external_id: string;
  title: string;
  excerpt: string | null;
  raw_text: string | null;
  published_at: Date | string;
  discovered_at: Date | string;
  author: string | null;
  source_name: string;
  source_url: string;
  source_type: string;
  reliability_score: number | string;
  source_metadata: Record<string, unknown> | null;
};

export function filmRoomCategoryForSource(
  sourceType: string,
  metadata: Record<string, unknown> | null,
): FilmRoomCategory {
  const category = String(metadata?.category ?? '').toLowerCase();
  if (category === 'film' || category === 'league_media') return 'film-room';
  if (category === 'podcast') return 'podcasts';
  if (category === 'local_media') return 'local-shows';
  if (category === 'official' || sourceType === 'OFFICIAL_TEAM') return 'press-conferences';
  return 'fan-creators';
}

export function discoveredRowToFilmRoomVideo(row: DiscoveredFilmRoomRow): FilmRoomVideo | null {
  const videoId = row.external_id.trim();
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) return null;

  const publishedAt = new Date(row.published_at);
  const addedAt = new Date(row.discovered_at);
  if (!Number.isFinite(publishedAt.getTime()) || !Number.isFinite(addedAt.getTime())) return null;

  const channelId = String(row.source_metadata?.youtubeChannelId ?? '');
  const channelUrl = channelId
    ? `https://www.youtube.com/channel/${encodeURIComponent(channelId)}`
    : row.source_url;
  const reliability = Number(row.reliability_score);

  return {
    id: videoId,
    category: filmRoomCategoryForSource(row.source_type, row.source_metadata),
    score: Number.isFinite(reliability) ? Math.round(reliability * 100) : 75,
    addedAt: addedAt.toISOString(),
    title: row.title,
    description: row.excerpt?.trim() || row.raw_text?.trim() || null,
    thumbnail: `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`,
    duration: '',
    publishedAt: publishedAt.toISOString(),
    viewCount: null,
    channel: {
      id: channelId,
      name: row.author?.trim() || row.source_name,
      avatar: null,
      subscriberCount: null,
    },
    youtubeUrl: `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`,
    embedUrl: `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?autoplay=1&rel=0`,
    channelUrl,
  };
}

export async function loadDiscoveredFilmRoomVideos(teamId: string): Promise<FilmRoomVideo[]> {
  const sql = authDb();
  const normalizedTeamId = teamId.toUpperCase();
  const rows = await sql<DiscoveredFilmRoomRow[]>`
    SELECT
      candidate.external_id,
      candidate.title,
      candidate.excerpt,
      candidate.raw_text,
      candidate.published_at,
      candidate.discovered_at,
      candidate.author,
      source.name AS source_name,
      source.url AS source_url,
      source.source_type,
      source.reliability_score,
      source.metadata AS source_metadata
    FROM content_candidates candidate
    JOIN content_sources source ON source.id = candidate.source_id
    WHERE source.metadata->>'platform' = 'YOUTUBE'
      AND candidate.status NOT IN ('REJECTED', 'FAILED')
      AND lower(candidate.title) NOT IN ('[private video]', '[deleted video]')
      AND (
        source.team_id = ${normalizedTeamId}
        OR candidate.candidate_teams @> ${sql.json([normalizedTeamId])}
      )
    ORDER BY candidate.published_at DESC, candidate.discovered_at DESC
  `;

  const seen = new Set<string>();
  return rows.flatMap((row) => {
    if (seen.has(row.external_id)) return [];
    const video = discoveredRowToFilmRoomVideo(row);
    if (!video) return [];
    seen.add(video.id);
    return [video];
  });
}
