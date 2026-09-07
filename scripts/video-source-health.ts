import { loadEnvConfig } from '@next/env';
import postgres from 'postgres';

async function main() {
  loadEnvConfig(process.cwd());
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required.');
  const sql = postgres(url, { max: 1, ssl: url.includes('localhost') ? false : 'require' });
  try {
    const rows = await sql`SELECT r.team_id,
  bool_or(r.category='official' AND r.status='ACTIVE') AS official,
  bool_or(r.name ILIKE 'Locked On %' AND r.status='ACTIVE') AS locked_on,
  count(*) FILTER (WHERE r.status='ACTIVE' AND r.category NOT IN ('official','podcast'))::int AS independent_active,
  count(*) FILTER (WHERE r.status='REVIEW_REQUIRED')::int AS review_required,
  count(DISTINCT c.id) FILTER (WHERE c.discovered_at>=now()-interval '7 days')::int AS discovered,
  count(DISTINCT c.id) FILTER (WHERE c.discovered_at>=now()-interval '7 days' AND c.status NOT IN ('REJECTED','FAILED'))::int AS accepted,
  count(DISTINCT c.id) FILTER (WHERE c.discovered_at>=now()-interval '7 days' AND c.status='REJECTED')::int AS rejected
 FROM video_source_registry r LEFT JOIN content_candidates c ON c.source_id=r.id
 WHERE r.team_id IS NOT NULL GROUP BY r.team_id ORDER BY r.team_id`;
    console.table(rows);
    const focus = new Set(['KC', 'CHI', 'BUF', 'PHI', 'DEN', 'DET']);
    const details =
      await sql`SELECT team_id,name,category,status,youtube_channel_id,last_upload_at,review_reason FROM video_source_registry WHERE team_id IN ('KC','CHI','BUF','PHI','DEN','DET') ORDER BY team_id,priority,name`;
    console.log('\nDetailed review teams');
    console.table(details.filter((row) => focus.has(String(row.team_id))));
  } finally {
    await sql.end();
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
