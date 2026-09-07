import { loadEnvConfig } from '@next/env';
import postgres from 'postgres';
import { VIDEO_SOURCE_CANDIDATES } from '@/data/sources/video/catalog';

async function main() {
  loadEnvConfig(process.cwd());
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required.');
  const sql = postgres(databaseUrl, {
    max: 1,
    ssl: databaseUrl.includes('localhost') ? false : 'require',
  });

  try {
    for (const source of VIDEO_SOURCE_CANDIDATES) {
      await sql`INSERT INTO video_source_registry(id,name,team_id,category,tags,scope,multi_team,priority,source_weight,youtube_channel_id,youtube_handle,youtube_url,status,review_reason)
  VALUES(${source.id},${source.name},${source.teamId},${source.category},${sql.json(source.tags)},${source.scope},${source.multiTeam},${source.priority},${source.sourceWeight},${source.youtubeChannelId ?? null},${source.youtubeHandle ?? null},${source.youtubeUrl ?? null},${source.status},${source.reviewReason})
  ON CONFLICT(id) DO UPDATE SET name=excluded.name,team_id=excluded.team_id,category=excluded.category,tags=excluded.tags,scope=excluded.scope,multi_team=excluded.multi_team,priority=excluded.priority,source_weight=excluded.source_weight,updated_at=now()`;
    }
    console.log(
      `Seeded ${VIDEO_SOURCE_CANDIDATES.length} curated candidates; unresolved channels remain REVIEW_REQUIRED.`,
    );
  } finally {
    await sql.end();
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
