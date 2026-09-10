import { TEAM_LIST } from '@/data/teams';
import {
  getEditorialOverrides,
  applyEditorialOverrides,
} from '@/features/three-and-out/editorial-store';
import { THREE_AND_OUT_SUMMARY_VERSION } from '@/features/three-and-out/config';
import {
  buildDailyBriefingPush,
  dateInTimezone,
  isDailyBriefingDeliveryDue,
  selectDailyBriefingStories,
} from '@/features/three-and-out/daily';
import type {
  HistoricalThreeAndOut,
  ThreeAndOutPackage,
  ThreeAndOutSource,
  ThreeAndOutStory,
} from '@/features/three-and-out/types';
import { authDb } from '@/server/auth/database';
import { listPublicStories } from '@/server/story-engine/projections';
import { sendPush } from '@/server/notifications/push';

const TEAM_TIMEZONES: Record<string, string> = {
  ARI: 'America/Phoenix',
  DEN: 'America/Denver',
  LV: 'America/Los_Angeles',
  LAC: 'America/Los_Angeles',
  LAR: 'America/Los_Angeles',
  SF: 'America/Los_Angeles',
  SEA: 'America/Los_Angeles',
  KC: 'America/Chicago',
  CHI: 'America/Chicago',
  DAL: 'America/Chicago',
  GB: 'America/Chicago',
  HOU: 'America/Chicago',
  MIN: 'America/Chicago',
  NO: 'America/Chicago',
  TEN: 'America/Chicago',
};

const teamTimezone = (teamId: string) => TEAM_TIMEZONES[teamId] ?? 'America/New_York';
const sources = (story: any): ThreeAndOutSource[] =>
  story.sources.map((source: any) => ({
    id: source.id,
    storyId: story.id,
    sourceName: source.name,
    authorName: null,
    sourceType: source.official ? 'OFFICIAL' : 'REPORTING',
    sourceUrl: source.url,
    publishedAt: source.publishedAt,
    isOriginalReporter: source.original,
    isOfficialSource: source.official,
  }));

const asStory = (story: any, rank: number): ThreeAndOutStory => ({
  id: story.id,
  teamId: story.teamId,
  title: story.headline,
  shortTitle: story.headline,
  summary: story.whatHappened || story.shortSummary,
  whyItMatters: story.whyItMatters,
  whatsNext: story.whatsNext,
  status: story.status,
  importanceScore: story.importanceScore,
  scoreSignals: {
    footballImpact: story.importanceScore,
    sourceStrength: story.confidenceScore,
    velocity: Math.min(100, story.sources.length * 25),
    freshness: 90,
    fanInterest: story.importanceScore,
    novelty: story.version === 1 ? 90 : 55,
  },
  previousRank: null,
  currentRank: rank,
  createdAt: story.firstReportedAt,
  updatedAt: story.lastMeaningfulUpdateAt,
  firstPublishedAt: story.firstReportedAt,
  lastMaterialUpdateAt: story.lastMeaningfulUpdateAt,
  sourceCount: story.sources.length,
  sources: sources(story),
  videoStatus: 'NONE',
  audioStatus: 'DISABLED',
  category: story.storyType,
  imageUrl: story.imageUrl ?? null,
  destinationUrl: story.sources[0]?.url ?? `/the-beat?team=${story.teamId}`,
});

type SnapshotRow = {
  id: string;
  teamId: string;
  briefingDate: string | Date;
  generatedAt: string | Date;
  publishedAt: string | Date | null;
  sourceWindowStart: string | Date | null;
  sourceWindowEnd: string | Date | null;
  summaryVersion: string;
  items: ThreeAndOutStory[];
};

const iso = (value: string | Date | null | undefined) =>
  value ? new Date(value).toISOString() : undefined;
const dateOnly = (value: string | Date) =>
  typeof value === 'string' ? value.slice(0, 10) : value.toISOString().slice(0, 10);

const rowPackage = (
  row: SnapshotRow,
  teamName: string,
  previous: HistoricalThreeAndOut[],
): ThreeAndOutPackage => {
  const stories = row.items.slice(0, 3) as [ThreeAndOutStory, ThreeAndOutStory, ThreeAndOutStory];
  return {
    current: {
      id: row.id,
      teamId: row.teamId,
      teamName,
      generatedAt: iso(row.generatedAt)!,
      briefingDate: dateOnly(row.briefingDate),
      publishedAt: iso(row.publishedAt),
      sourceWindowStart: iso(row.sourceWindowStart),
      sourceWindowEnd: iso(row.sourceWindowEnd),
      summaryVersion: row.summaryVersion,
      storyIds: stories.map((story) => story.id) as [string, string, string],
      stories,
      puntStories: [],
      fourthDown: {
        id: `${row.id}:poll`,
        teamId: row.teamId,
        question: '',
        options: [],
        associatedStoryIds: [],
      },
      audioStatus: 'DISABLED',
      audioUrl: null,
      audioDuration: null,
      audioGeneratedAt: null,
      audioScriptVersion: row.summaryVersion,
      videoStatus: 'NONE',
      videoUrl: null,
      videoThumbnail: null,
      videoDuration: null,
      videoGeneratedAt: null,
      videoSnapshotId: null,
    },
    previous,
  };
};

const selectRows = async (teamId: string, briefingDate?: string) => authDb()<SnapshotRow[]>`
  SELECT id, team_id AS "teamId", briefing_date AS "briefingDate", generated_at AS "generatedAt",
    published_at AS "publishedAt", source_window_start AS "sourceWindowStart",
    source_window_end AS "sourceWindowEnd", summary_version AS "summaryVersion", items
  FROM three_and_out_snapshots
  WHERE team_id=${teamId} AND status='PUBLISHED' AND items IS NOT NULL
    ${briefingDate ? authDb()`AND briefing_date=${briefingDate}` : authDb()``}
  ORDER BY briefing_date DESC, published_at DESC NULLS LAST LIMIT 1`;

export async function getDailyThreeAndOut(teamId: string, briefingDate?: string) {
  const team = TEAM_LIST.find((candidate) => candidate.abbr === teamId);
  if (!team) return null;
  const rows = await selectRows(teamId, briefingDate);
  if (!rows[0] || !Array.isArray(rows[0].items) || rows[0].items.length !== 3) return null;
  const archiveRows = await authDb()<SnapshotRow[]>`
    SELECT id, team_id AS "teamId", briefing_date AS "briefingDate", generated_at AS "generatedAt",
      published_at AS "publishedAt", source_window_start AS "sourceWindowStart",
      source_window_end AS "sourceWindowEnd", summary_version AS "summaryVersion", items
    FROM three_and_out_snapshots WHERE team_id=${teamId} AND status='PUBLISHED' AND items IS NOT NULL
      AND id<>${rows[0].id} ORDER BY briefing_date DESC LIMIT 14`;
  const previous = archiveRows
    .filter((row) => row.items.length === 3)
    .map((row) => ({
      id: row.id,
      teamId,
      teamName: team.name,
      generatedAt: iso(row.generatedAt)!,
      briefingDate: dateOnly(row.briefingDate),
      storyIds: row.items.map((story) => story.id) as [string, string, string],
      storyTitles: row.items.map((story) => story.title) as [string, string, string],
    }));
  return rowPackage(rows[0], team.name, previous);
}

export async function generateDailyThreeAndOut(
  teamId: string,
  options: { now?: Date; force?: boolean } = {},
) {
  const team = TEAM_LIST.find((candidate) => candidate.abbr === teamId);
  if (!team) return null;
  const now = options.now ?? new Date();
  const briefingDate = dateInTimezone(now, teamTimezone(teamId));
  if (!options.force) {
    const existing = await getDailyThreeAndOut(teamId, briefingDate);
    if (existing) return existing;
  }
  const previous = await authDb()<{ publishedAt: Date }[]>`
    SELECT published_at AS "publishedAt" FROM three_and_out_snapshots
    WHERE team_id=${teamId} AND status='PUBLISHED' AND published_at IS NOT NULL
    ORDER BY published_at DESC LIMIT 1`;
  const windowStart = previous[0]?.publishedAt ?? new Date(now.getTime() - 26 * 3_600_000);
  const publicStories = await listPublicStories(teamId, 80);
  const candidates = publicStories
    .filter(
      (story) =>
        new Date(story.lastMeaningfulUpdateAt) > windowStart || story.status === 'BREAKING',
    )
    .map(asStory);
  const selected = selectDailyBriefingStories(
    applyEditorialOverrides(candidates, getEditorialOverrides(teamId)),
    teamId,
    now,
  );
  if (selected.length !== 3) {
    console.warn(
      JSON.stringify({
        metric: 'three_and_out_generation_skipped',
        teamId,
        briefingDate,
        eligible: selected.length,
      }),
    );
    return null;
  }
  const id = `daily:${teamId}:${briefingDate}`;
  await authDb()`INSERT INTO three_and_out_snapshots
    (id,team_id,story_ids,story_versions,generated_at,briefing_date,status,source_window_start,
      source_window_end,published_at,items,summary_version,audio_status,updated_at)
    VALUES(${id},${teamId},${authDb().json(selected.map((story) => story.id))},${authDb().json(selected.map(() => 1))},
      ${now},${briefingDate},'PUBLISHED',${windowStart},${now},${now},${authDb().json(selected)},
      ${THREE_AND_OUT_SUMMARY_VERSION},'DISABLED',now())
    ON CONFLICT(id) DO UPDATE SET story_ids=excluded.story_ids, generated_at=excluded.generated_at,
      source_window_start=excluded.source_window_start,source_window_end=excluded.source_window_end,
      published_at=excluded.published_at,items=excluded.items,summary_version=excluded.summary_version,
      audio_status='DISABLED',updated_at=now()`;
  console.info(
    JSON.stringify({
      metric: 'three_and_out_generated',
      teamId,
      briefingDate,
      storyIds: selected.map((story) => story.id),
    }),
  );
  return getDailyThreeAndOut(teamId, briefingDate);
}

export async function generateAllDailyThreeAndOut(options: { now?: Date; force?: boolean } = {}) {
  const results = [];
  for (const team of TEAM_LIST) {
    try {
      results.push({
        teamId: team.abbr,
        generated: Boolean(await generateDailyThreeAndOut(team.abbr, options)),
      });
    } catch (error) {
      results.push({
        teamId: team.abbr,
        generated: false,
        error: error instanceof Error ? error.message : 'unknown',
      });
    }
  }
  return results;
}

type PushCandidate = SnapshotRow & { userId: string; timezone: string };

export async function deliverDueDailyThreeAndOut(now = new Date()) {
  const candidates = await authDb()<PushCandidate[]>`
    SELECT s.id,s.team_id AS "teamId",s.briefing_date AS "briefingDate",
      s.generated_at AS "generatedAt",s.published_at AS "publishedAt",
      s.source_window_start AS "sourceWindowStart",s.source_window_end AS "sourceWindowEnd",
      s.summary_version AS "summaryVersion",s.items,u.id AS "userId",
      coalesce(p.timezone,'America/New_York') AS timezone
    FROM three_and_out_snapshots s
    JOIN user_preferences pref ON pref.favorite_team_abbr=s.team_id AND pref.push_enabled=true
    JOIN users u ON u.id=pref.user_id
    JOIN user_profiles p ON p.user_id=u.id
    WHERE s.status='PUBLISHED' AND s.items IS NOT NULL AND s.briefing_date >= current_date - 1
      AND NOT EXISTS (
        SELECT 1 FROM user_notification_preferences np
        WHERE np.user_id=u.id AND np.category='THREE_AND_OUT_DAILY'
          AND np.channel='PUSH' AND np.enabled=false
      )`;
  let sent = 0;
  let skipped = 0;
  for (const candidate of candidates) {
    const briefingDate = dateOnly(candidate.briefingDate);
    if (
      dateInTimezone(now, candidate.timezone) !== briefingDate ||
      !isDailyBriefingDeliveryDue(now, candidate.timezone)
    ) {
      skipped += 1;
      continue;
    }
    const claimed = await authDb()<{ briefingId: string }[]>`
      INSERT INTO three_and_out_push_deliveries
        (briefing_id,user_id,channel,status,attempt_count,attempted_at,updated_at)
      VALUES(${candidate.id},${candidate.userId},'PUSH','PENDING',1,now(),now())
      ON CONFLICT(briefing_id,user_id,channel) DO UPDATE SET
        status='PENDING',attempt_count=three_and_out_push_deliveries.attempt_count+1,
        attempted_at=now(),updated_at=now()
      WHERE three_and_out_push_deliveries.status='FAILED'
        AND three_and_out_push_deliveries.attempt_count<3
      RETURNING briefing_id AS "briefingId"`;
    if (!claimed[0]) {
      skipped += 1;
      continue;
    }
    const payload = buildDailyBriefingPush({
      teamId: candidate.teamId,
      teamName: TEAM_LIST.find((team) => team.abbr === candidate.teamId)?.name ?? candidate.teamId,
      briefingDate,
      stories: candidate.items,
    });
    try {
      const result = await sendPush({
        userId: candidate.userId,
        eventId: `three-and-out:${candidate.id}:${candidate.userId}`,
        ...payload,
        data: { type: 'THREE_AND_OUT_DAILY', teamId: candidate.teamId, briefingDate },
      });
      const status = result.ok ? 'SENT' : 'SUPPRESSED';
      await authDb()`UPDATE three_and_out_push_deliveries SET status=${status},
        delivered_at=${result.ok ? now : null},last_error=${result.ok ? null : (result.reason ?? 'Suppressed')},updated_at=now()
        WHERE briefing_id=${candidate.id} AND user_id=${candidate.userId} AND channel='PUSH'`;
      if (result.ok) sent += 1;
    } catch (error) {
      await authDb()`UPDATE three_and_out_push_deliveries SET status='FAILED',
        last_error=${error instanceof Error ? error.message.slice(0, 300) : 'Push failed'},updated_at=now()
        WHERE briefing_id=${candidate.id} AND user_id=${candidate.userId} AND channel='PUSH'`;
    }
  }
  console.info(
    JSON.stringify({
      metric: 'three_and_out_push_delivery',
      candidates: candidates.length,
      sent,
      skipped,
    }),
  );
  return { candidates: candidates.length, sent, skipped };
}
