import { TEAM_LIST } from '@/data/teams';
import { assertNFLTeamCoverage, getMonitoringSources } from '@/data/sources/monitoring';
import { authDb } from '@/server/auth/database';

export type ContentHealthState = 'HEALTHY' | 'STALE' | 'NO_CONTENT' | 'FAILED' | 'MISCONFIGURED';

export type TeamContentHealth = {
  teamId: string;
  configuredSources: number;
  enabledSources: number;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  latestStoryAt: string | null;
  beatStoriesToday: number;
  homepageCandidates: number;
  threeAndOutDate: string | null;
  threeAndOutReady: boolean;
  failedSources: number;
  rejectedCandidates24h: number;
  status: ContentHealthState;
  contentNote: 'FRESH' | 'QUIET' | 'NO_CONTENT';
  warnings: string[];
};

const iso = (value: Date | string | null | undefined) =>
  value ? new Date(value).toISOString() : null;
const hoursSince = (value: string | null, now: Date) =>
  value ? Math.max(0, (now.getTime() - new Date(value).getTime()) / 3_600_000) : Infinity;

export async function auditContentHealth(now = new Date()) {
  const coverage = assertNFLTeamCoverage();
  const sql = authDb();
  const [sources, stories, briefings, rejected] = await Promise.all([
    sql<any[]>`SELECT team_id AS "teamId", enabled, last_checked_at AS "lastCheckedAt",
      last_successful_at AS "lastSuccessfulAt", consecutive_failures AS "consecutiveFailures",
      last_error AS "lastError" FROM content_sources WHERE team_id IS NOT NULL`,
    sql<any[]>`SELECT team_id AS "teamId", max(last_meaningful_update_at) AS "latestStoryAt",
      count(*) FILTER (WHERE last_meaningful_update_at >= date_trunc('day', ${now}::timestamptz))::int AS "todayCount",
      count(*) FILTER (WHERE last_meaningful_update_at >= ${new Date(now.getTime() - 72 * 3_600_000)}
        AND publication_state IN ('PUBLISHED','AUTO_PUBLISHED') AND status<>'HOLDING')::int AS "homepageCandidates"
      FROM canonical_stories WHERE team_id IS NOT NULL
      AND publication_state IN ('PUBLISHED','AUTO_PUBLISHED') GROUP BY team_id`,
    sql<any[]>`SELECT DISTINCT ON (team_id) team_id AS "teamId", briefing_date AS "briefingDate",
      jsonb_array_length(items) AS "itemCount" FROM three_and_out_snapshots
      WHERE status='PUBLISHED' AND items IS NOT NULL ORDER BY team_id, briefing_date DESC`,
    sql<any[]>`SELECT source.team_id AS "teamId", count(*)::int AS count
      FROM content_candidates candidate JOIN content_sources source ON source.id=candidate.source_id
      WHERE candidate.status IN ('REJECTED','REVIEW_REQUIRED','FAILED')
        AND candidate.updated_at >= ${new Date(now.getTime() - 24 * 3_600_000)}
        AND source.team_id IS NOT NULL GROUP BY source.team_id`,
  ]);
  const byTeam = <T extends { teamId: string }>(rows: T[]) =>
    new Map(rows.map((row) => [row.teamId, row]));
  const storyByTeam = byTeam(stories);
  const briefingByTeam = byTeam(briefings);
  const rejectedByTeam = byTeam(rejected);

  const teams: TeamContentHealth[] = TEAM_LIST.map((team) => {
    const definitions = getMonitoringSources(team.abbr).filter(
      (source) => source.teamId === team.abbr && source.active,
    );
    const sourceRows = sources.filter((source) => source.teamId === team.abbr);
    const lastAttemptAt = iso(
      sourceRows.reduce<Date | null>(
        (latest, source) =>
          !latest || (source.lastCheckedAt && new Date(source.lastCheckedAt) > latest)
            ? source.lastCheckedAt
              ? new Date(source.lastCheckedAt)
              : latest
            : latest,
        null,
      ),
    );
    const lastSuccessAt = iso(
      sourceRows.reduce<Date | null>(
        (latest, source) =>
          !latest || (source.lastSuccessfulAt && new Date(source.lastSuccessfulAt) > latest)
            ? source.lastSuccessfulAt
              ? new Date(source.lastSuccessfulAt)
              : latest
            : latest,
        null,
      ),
    );
    const story = storyByTeam.get(team.abbr);
    const latestStoryAt = iso(story?.latestStoryAt);
    const failedSources = sourceRows.filter(
      (source) => Number(source.consecutiveFailures ?? 0) >= 3,
    ).length;
    const warnings: string[] = [];
    let status: ContentHealthState = 'HEALTHY';
    if (!definitions.length) status = 'MISCONFIGURED';
    else if (failedSources && hoursSince(lastSuccessAt, now) > 12) status = 'FAILED';
    else if (hoursSince(lastAttemptAt, now) > 12) status = 'STALE';
    const storyAge = hoursSince(latestStoryAt, now);
    const contentNote = storyAge <= 24 ? 'FRESH' : storyAge <= 48 ? 'QUIET' : 'NO_CONTENT';
    if (contentNote === 'NO_CONTENT') warnings.push('No published story in the last 48 hours.');
    if (!briefingByTeam.get(team.abbr)) warnings.push('No published Three & Out snapshot.');
    if (sourceRows.length < definitions.length)
      warnings.push(
        `${definitions.length - sourceRows.length} configured source(s) are not registered.`,
      );
    return {
      teamId: team.abbr,
      configuredSources: definitions.length,
      enabledSources: sourceRows.filter((source) => source.enabled).length,
      lastAttemptAt,
      lastSuccessAt,
      latestStoryAt,
      beatStoriesToday: Number(story?.todayCount ?? 0),
      homepageCandidates: Number(story?.homepageCandidates ?? 0),
      threeAndOutDate: briefingByTeam.get(team.abbr)?.briefingDate
        ? String(briefingByTeam.get(team.abbr).briefingDate).slice(0, 10)
        : null,
      threeAndOutReady: Number(briefingByTeam.get(team.abbr)?.itemCount ?? 0) === 3,
      failedSources,
      rejectedCandidates24h: Number(rejectedByTeam.get(team.abbr)?.count ?? 0),
      status,
      contentNote,
      warnings,
    };
  });
  return {
    generatedAt: now.toISOString(),
    coverage,
    totals: {
      teams: teams.length,
      healthy: teams.filter((team) => team.status === 'HEALTHY').length,
      stale: teams.filter((team) => team.status === 'STALE').length,
      failed: teams.filter((team) => team.status === 'FAILED').length,
      misconfigured: teams.filter((team) => team.status === 'MISCONFIGURED').length,
      noContent: teams.filter((team) => team.contentNote === 'NO_CONTENT').length,
      configuredSources: teams.reduce((sum, team) => sum + team.configuredSources, 0),
      enabledSources: teams.reduce((sum, team) => sum + team.enabledSources, 0),
      storiesToday: teams.reduce((sum, team) => sum + team.beatStoriesToday, 0),
      threeAndOutReady: teams.filter((team) => team.threeAndOutReady).length,
    },
    teams,
  };
}
