import { loadEnvConfig } from '@next/env';
import postgres from 'postgres';
import { VIDEO_SOURCE_CANDIDATES, NFL_TEAM_NAMES } from '@/data/sources/video/catalog';

async function main() {
  loadEnvConfig(process.cwd());
  const apiKey = process.env.YOUTUBE_API_KEY;
  const databaseUrl = process.env.DATABASE_URL;
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

  try {
    for (const candidate of VIDEO_SOURCE_CANDIDATES) {
      // A name-only search result is deliberately never activated. Editorially supplied
      // channel URLs are resolved through forHandle and then checked for cadence/relevance.
      if (!candidate.candidateUrl) {
        await sql`UPDATE video_source_registry SET status='REVIEW_REQUIRED',review_reason='Could not confidently resolve YouTube channel: no authoritative candidate URL supplied.',updated_at=now() WHERE id=${candidate.id}`;
        continue;
      }
      try {
        const handle = handleFrom(candidate.candidateUrl);
        if (!handle) throw new Error('Candidate URL does not contain a YouTube handle');
        const channelData = await api(
          `channels?part=snippet,contentDetails&forHandle=${encodeURIComponent(handle.slice(1))}`,
        );
        const channel = channelData.items?.[0];
        if (!channel?.id) throw new Error('YouTube did not resolve this handle');
        const uploads = channel.contentDetails?.relatedPlaylists?.uploads;
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
      VALUES(${candidate.id},${candidate.name},${candidate.category === 'official' ? 'OFFICIAL_TEAM' : candidate.category === 'league_media' ? 'NFL_OFFICIAL' : 'YOUTUBE'},${candidate.teamId},${candidate.scope === 'league'},${canonicalUrl},'STRUCTURED_API',${candidate.priority === 1 ? 'A' : 'B'},${Math.round(candidate.sourceWeight * 100)},${candidate.sourceWeight},7200,true,${tx.json({ platform: 'YOUTUBE', youtubeChannelId: channel.id, youtubeHandle: handle, category: candidate.category, tags: candidate.tags, scope: candidate.scope, multiTeam: candidate.multiTeam, sourceWeight: candidate.sourceWeight } as any)})
      ON CONFLICT(id) DO UPDATE SET name=excluded.name,url=excluded.url,priority=excluded.priority,reliability_score=excluded.reliability_score,enabled=true,metadata=excluded.metadata,updated_at=now()`;
        });
      } catch (error) {
        await sql`UPDATE video_source_registry SET status='ERROR',review_reason=${error instanceof Error ? error.message : String(error)},updated_at=now() WHERE id=${candidate.id}`;
      }
    }
  } finally {
    await sql.end();
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
