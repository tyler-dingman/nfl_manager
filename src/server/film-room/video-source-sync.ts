import { authDb } from '@/server/auth/database';

const VERIFIED_VIDEO_SOURCES = {
  CHI: [
    {
      id: 'YT_CHI_CHICAGO_BEARS',
      name: 'Chicago Bears',
      sourceType: 'OFFICIAL_TEAM',
      category: 'official',
      channelId: 'UCP0Cdc6moLMyDJiO0s-yhbQ',
    },
    {
      id: 'YT_CHI_LOCKED_ON_BEARS',
      name: 'Locked On Bears',
      sourceType: 'YOUTUBE',
      category: 'podcast',
      channelId: 'UCXCnRo-iwMsS4iC1SobeGHA',
    },
  ],
} as const;

export async function syncVerifiedVideoSources(teamId: string, force = false) {
  const sql = authDb();
  const sources = VERIFIED_VIDEO_SOURCES[teamId as keyof typeof VERIFIED_VIDEO_SOURCES] ?? [];
  for (const source of sources) {
    const uploadsPlaylistId = `UU${source.channelId.slice(2)}`;
    const url = `https://www.youtube.com/channel/${source.channelId}`;
    await sql`
      INSERT INTO content_sources(
        id,name,source_type,team_id,league_wide,url,fetch_strategy,polling_tier,
        priority,reliability_score,check_interval_seconds,enabled,metadata,next_check_at
      ) VALUES(
        ${source.id},${source.name},${source.sourceType},${teamId},false,${url},
        'STRUCTURED_API','A',100,1,14400,true,
        ${sql.json({
          platform: 'YOUTUBE',
          youtubeChannelId: source.channelId,
          youtubeUploadsPlaylistId: uploadsPlaylistId,
          category: source.category,
          scope: 'team',
          multiTeam: false,
          publishAll: true,
        })},now()
      )
      ON CONFLICT(id) DO UPDATE SET
        name=excluded.name,
        source_type=excluded.source_type,
        team_id=excluded.team_id,
        url=excluded.url,
        priority=excluded.priority,
        reliability_score=excluded.reliability_score,
        check_interval_seconds=excluded.check_interval_seconds,
        enabled=true,
        metadata=excluded.metadata,
        next_check_at=CASE WHEN ${force} THEN now() ELSE content_sources.next_check_at END,
        updated_at=now()
    `;
  }
  return sources.length;
}
