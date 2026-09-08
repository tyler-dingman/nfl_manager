import { loadEnvConfig } from '@next/env';
import postgres from 'postgres';
import { VIDEO_SOURCE_CANDIDATES, NFL_TEAM_NAMES } from '@/data/sources/video/catalog';
import {
  exactApprovedChannelMatch,
  videoResolutionPriority,
  type YouTubeChannelSearchResult,
} from '@/data/sources/video/resolution';

async function main() {
  loadEnvConfig(process.cwd());
  const apiKey = process.env.YOUTUBE_API_KEY;
  const databaseUrl = process.env.DATABASE_URL;
  const requestedSearchBudget = Number(process.env.YOUTUBE_SOURCE_SEARCH_BUDGET ?? 40);
  const searchBudget = Number.isInteger(requestedSearchBudget)
    ? Math.max(0, Math.min(requestedSearchBudget, 40))
    : 40;
  if (!apiKey)
    throw new Error('YOUTUBE_API_KEY is required; channel identities will not be guessed.');
  if (!databaseUrl) throw new Error('DATABASE_URL is required.');
  const sql = postgres(databaseUrl, {
    max: 1,
    ssl: databaseUrl.includes('localhost') ? false : 'require',
  });
  const api = async (path: string) => {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/${path}${path.includes('?') ? '&' : '?'}key=${encodeURIComponent(apiKey)}`,
    );
    if (!response.ok) throw new Error(`YouTube API ${response.status}: ${await response.text()}`);
    return response.json() as Promise<any>;
  };
  const handleFrom = (url: string) =>
    new URL(url).pathname
      .split('/')
      .filter(Boolean)
      .find((value) => value.startsWith('@'));
  let searchesUsed = 0;
  let activated = 0;
  let stillReview = 0;

  const candidates = [...VIDEO_SOURCE_CANDIDATES].sort(
    (left, right) =>
      videoResolutionPriority(left.category) - videoResolutionPriority(right.category) ||
      (left.teamId ?? 'NFL').localeCompare(right.teamId ?? 'NFL') ||
      left.name.localeCompare(right.name),
  );

  try {
    const activeRows = await sql<
      { id: string }[]
    >`SELECT id FROM video_source_registry WHERE status='ACTIVE'`;
    const alreadyActive = new Set(activeRows.map((row) => row.id));
    for (const candidate of candidates) {
      if (alreadyActive.has(candidate.id)) continue;
      try {
        const suppliedHandle = candidate.candidateUrl ? handleFrom(candidate.candidateUrl) : null;
        let discoveredChannelId: string | null = null;
        if (!suppliedHandle) {
          if (searchesUsed >= searchBudget) {
            stillReview++;
            continue;
          }
          searchesUsed++;
          const teamName = candidate.teamId ? NFL_TEAM_NAMES[candidate.teamId] : '';
          const search = await api(
            `search?part=snippet&type=channel&maxResults=5&q=${encodeURIComponent(`${candidate.name} ${teamName}`.trim())}`,
          );
          const match = exactApprovedChannelMatch(
            candidate.name,
            (search.items ?? []) as YouTubeChannelSearchResult[],
          );
          discoveredChannelId = match?.id?.channelId ?? match?.snippet?.channelId ?? null;
          if (!discoveredChannelId) {
            await sql`UPDATE video_source_registry SET status='REVIEW_REQUIRED',review_reason='Approved source name did not produce one exact YouTube channel-title match.',updated_at=now() WHERE id=${candidate.id}`;
            stillReview++;
            continue;
          }
        }
        const channelData = suppliedHandle
          ? await api(
              `channels?part=snippet,contentDetails&forHandle=${encodeURIComponent(suppliedHandle.slice(1))}`,
            )
          : await api(
              `channels?part=snippet,contentDetails&id=${encodeURIComponent(discoveredChannelId!)}`,
            );
        const channel = channelData.items?.[0];
        if (!channel?.id) throw new Error('YouTube did not resolve this handle');
        const uploads = channel.contentDetails?.relatedPlaylists?.uploads;
        if (!uploads) throw new Error('YouTube did not return the channel uploads playlist');
        const videos = uploads
          ? await api(
              `playlistItems?part=snippet&playlistId=${encodeURIComponent(uploads)}&maxResults=20`,
            )
          : { items: [] };
        const lastUpload = videos.items?.[0]?.snippet?.publishedAt ?? null;
        const active = lastUpload && Date.now() - new Date(lastUpload).getTime() <= 120 * 86400000;
        const teamName = candidate.teamId ? NFL_TEAM_NAMES[candidate.teamId] : null;
        const teamTokens =
          teamName
            ?.toLowerCase()
            .split(' ')
            .filter((token) => token.length > 3) ?? [];
        const recentText =
          videos.items
            ?.map((item: any) =>
              `${item.snippet?.title ?? ''} ${item.snippet?.description ?? ''}`.toLowerCase(),
            )
            .join(' ') ?? '';
        const relevant = !teamName || teamTokens.some((token) => recentText.includes(token));
        const status = active && relevant ? 'ACTIVE' : 'REVIEW_REQUIRED';
        const reason = !active
          ? 'Channel has not uploaded in 120 days'
          : !relevant
            ? `Recent uploads do not establish substantial ${candidate.teamId} coverage`
            : null;
        const canonicalUrl = `https://www.youtube.com/channel/${channel.id}`;
        const handle = suppliedHandle ?? channel.snippet?.customUrl ?? null;
        await sql.begin(async (tx) => {
          const duplicate =
            await tx`SELECT id FROM video_source_registry WHERE youtube_channel_id=${channel.id} AND id<>${candidate.id} LIMIT 1`;
          if (duplicate.length) {
            await tx`UPDATE video_source_registry SET status='REVIEW_REQUIRED',review_reason=${`Duplicate YouTube channel ID already used by ${duplicate[0].id}`},updated_at=now() WHERE id=${candidate.id}`;
            return;
          }
          await tx`UPDATE video_source_registry SET youtube_channel_id=${channel.id},youtube_handle=${handle},youtube_url=${canonicalUrl},status=${status},review_reason=${reason},last_verified_at=now(),last_upload_at=${lastUpload},updated_at=now() WHERE id=${candidate.id}`;
          if (status === 'ACTIVE')
            await tx`INSERT INTO content_sources(id,name,source_type,team_id,league_wide,url,fetch_strategy,polling_tier,priority,reliability_score,check_interval_seconds,enabled,metadata)
          VALUES(${candidate.id},${candidate.name},${candidate.category === 'official' ? 'OFFICIAL_TEAM' : candidate.category === 'league_media' ? 'NFL_OFFICIAL' : 'YOUTUBE'},${candidate.teamId},${candidate.scope === 'league'},${canonicalUrl},'STRUCTURED_API',${candidate.priority === 1 ? 'A' : 'B'},${Math.round(candidate.sourceWeight * 100)},${candidate.sourceWeight},14400,true,${tx.json({ platform: 'YOUTUBE', youtubeChannelId: channel.id, youtubeUploadsPlaylistId: uploads, youtubeHandle: handle, category: candidate.category, tags: candidate.tags, scope: candidate.scope, multiTeam: candidate.multiTeam, sourceWeight: candidate.sourceWeight } as any)})
          ON CONFLICT(id) DO UPDATE SET name=excluded.name,url=excluded.url,priority=excluded.priority,reliability_score=excluded.reliability_score,check_interval_seconds=excluded.check_interval_seconds,enabled=true,metadata=excluded.metadata,updated_at=now()`;
        });
        if (status === 'ACTIVE') activated++;
        else stillReview++;
      } catch (error) {
        await sql`UPDATE video_source_registry SET status='ERROR',review_reason=${error instanceof Error ? error.message : String(error)},updated_at=now() WHERE id=${candidate.id}`;
      }
    }
    console.log(
      JSON.stringify(
        {
          activated,
          searchesUsed,
          searchBudget,
          stillReview,
          note: 'Search budget is capped at 40.',
        },
        null,
        2,
      ),
    );
  } finally {
    await sql.end();
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
