import { randomUUID } from 'node:crypto';

import { MONITORING_THRESHOLDS } from '@/features/monitoring/config';
import { evaluateObserverNotification } from '@/features/monitoring/notification-policy';
import type { MonitoringTier, NotificationThresholds } from '@/features/monitoring/types';
import { authDb } from '@/server/auth/database';
import { getMonitoringSources } from '@/data/sources/monitoring';

const tierFor = (pollingTier: string): MonitoringTier =>
  pollingTier === 'A' ? 1 : pollingTier === 'B' ? 2 : 3;
const observerPublisherKey = (source: { name: string }) =>
  source.name
    .toLowerCase()
    .replace(/\s+(rss|web|x|youtube)$/i, '')
    .trim();

export async function syncMonitoringRegistry(teamId: string) {
  const sql = authDb();
  const sources = getMonitoringSources(teamId);
  for (const source of sources) {
    const rss = source.ingestionMethod === 'RSS_ATOM';
    const enabled = source.active && source.availability === 'LIVE' && rss;
    await sql`INSERT INTO content_sources(id,name,source_type,team_id,league_wide,url,feed_url,fetch_strategy,polling_tier,priority,reliability_score,check_interval_seconds,enabled,metadata)
      VALUES(${source.id},${source.name},${source.tier === 3 ? 'OTHER' : 'LOCAL_OUTLET'},${source.teamId},false,${source.canonicalUrl},${rss ? String(source.metadata.feedUrl) : null},${rss ? 'RSS' : 'STRUCTURED_API'},${source.tier === 1 ? 'A' : source.tier === 2 ? 'B' : 'C'},${source.authorityWeight},${source.authorityWeight / 100},${source.cadenceSeconds ?? 300},${enabled},${sql.json({ ...source.metadata, monitoringTier: source.tier, platform: source.platform, ingestionMethod: source.ingestionMethod, availability: source.availability, publishAll: true } as any)})
      ON CONFLICT(id) DO UPDATE SET name=excluded.name,url=excluded.url,feed_url=excluded.feed_url,polling_tier=excluded.polling_tier,priority=excluded.priority,reliability_score=excluded.reliability_score,check_interval_seconds=excluded.check_interval_seconds,enabled=excluded.enabled,metadata=excluded.metadata,updated_at=now()`;
  }
  return sources;
}

export async function startObserverRun(
  teamId: string,
  hours: number,
  thresholds = MONITORING_THRESHOLDS,
) {
  const id = randomUUID();
  const end = new Date(Date.now() + hours * 3_600_000);
  await authDb()`INSERT INTO observer_runs(id,team_id,status,scheduled_end_at,thresholds) VALUES(${id},${teamId},'RUNNING',${end},${authDb().json(thresholds)})`;
  return { id, scheduledEndAt: end };
}

export async function captureObserverSnapshot(runId: string) {
  const sql = authDb();
  const [run] = await sql`SELECT * FROM observer_runs WHERE id=${runId} AND status='RUNNING'`;
  if (!run) throw new Error('Observer run is not active.');
  await sql`INSERT INTO observer_run_items(run_id,candidate_id,source_id,source_tier,content_type,publication_time,detection_time,time_to_detection_ms)
    SELECT ${runId},c.id,c.source_id,CASE s.polling_tier WHEN 'A' THEN 1 WHEN 'B' THEN 2 ELSE 3 END,
      COALESCE(c.metadata->>'storyType','ANALYSIS'),c.published_at,c.discovered_at,
      GREATEST(0,EXTRACT(EPOCH FROM (c.discovered_at-c.published_at))*1000)::bigint
    FROM content_candidates c JOIN content_sources s ON s.id=c.source_id
    WHERE c.discovered_at>=${run.started_at} AND (s.team_id=${run.team_id} OR s.league_wide=true)
    ON CONFLICT DO NOTHING`;

  const stories = await sql`SELECT s.*,v.version AS captured_version,v.material_change_type,
    COALESCE(jsonb_agg(DISTINCT jsonb_build_object('id',src.id,'name',src.name,'url',e.source_url,'tier',src.polling_tier,'type',src.source_type,'platform',src.metadata->>'platform')) FILTER (WHERE src.id IS NOT NULL),'[]') AS sources
    FROM canonical_stories s JOIN story_versions v ON v.story_id=s.id
    LEFT JOIN story_evidence e ON e.story_id=s.id LEFT JOIN content_sources src ON src.id=e.source_id
    WHERE s.team_id=${run.team_id} AND v.created_at>=${run.started_at}
    GROUP BY s.id,v.version,v.material_change_type`;
  const thresholds = run.thresholds as NotificationThresholds;
  for (const story of stories) {
    const sources = story.sources as Array<{
      id: string;
      name: string;
      url: string;
      tier: string;
      type: string;
      platform: string | null;
    }>;
    const bestTier = Math.min(
      3,
      ...sources.map((source) => tierFor(source.tier)),
    ) as MonitoringTier;
    const official = sources.some((source) =>
      ['OFFICIAL_TEAM', 'NFL_OFFICIAL'].includes(source.type),
    );
    const independentSourceCount = new Set(
      sources.filter((item) => item.tier !== 'C').map(observerPublisherKey),
    ).size;
    const confirmedTransaction =
      ['TRADE', 'SIGNING', 'RELEASE', 'TRANSACTION'].includes(story.story_type) &&
      (official || independentSourceCount >= 2);
    const score = Number(
      (
        story.importance_score * 0.55 +
        story.confidence_score * 0.3 +
        (bestTier === 1 ? 15 : bestTier === 2 ? 8 : 2)
      ).toFixed(2),
    );
    const [prior] =
      await sql`SELECT 1 FROM observer_run_events WHERE run_id=${runId} AND story_id=${story.id} AND notification_decision='PUSH' LIMIT 1`;
    const decision = evaluateObserverNotification({
      score,
      tier: bestTier,
      official,
      confirmedTransaction,
      materialUpdate: story.material_change_type !== 'TRIVIAL' && story.captured_version > 1,
      alreadyNotified: Boolean(prior),
      thresholds,
    });
    const proposedPush = `${story.headline} — ${story.summary}`.slice(0, 220);
    await sql`INSERT INTO observer_run_events(run_id,story_id,story_version,event_creation_time,category,confidence,importance_score,score,sources,proposed_push,proposed_story,notification_decision,suppression_reason,time_to_proposed_notification_ms)
      VALUES(${runId},${story.id},${story.captured_version},${story.created_at},${story.story_type},${story.confidence_score},${story.importance_score},${score},${sql.json(sources)},${proposedPush},${sql.json({ headline: story.headline, threeAndOutSummary: story.summary, whyItMatters: story.why_it_matters, attribution: sources.map((source) => ({ name: source.name, url: source.url })), sourceCount: sources.length, independentSourceCount, clusterReason: story.cluster_reason, filmRoomEligible: story.story_type === 'VIDEO' || sources.some((source) => source.platform === 'YOUTUBE') } as any)},${decision.decision},${decision.decision === 'PUSH' ? null : decision.reason},${Math.max(0, Date.now() - new Date(story.first_reported_at).getTime())}) ON CONFLICT DO NOTHING`;
  }
  return {
    itemsCaptured: Number(
      (await sql`SELECT count(*)::int AS count FROM observer_run_items WHERE run_id=${runId}`)[0]
        ?.count ?? 0,
    ),
    eventsCaptured: Number(
      (await sql`SELECT count(*)::int AS count FROM observer_run_events WHERE run_id=${runId}`)[0]
        ?.count ?? 0,
    ),
  };
}

export async function completeObserverRun(
  runId: string,
  status: 'COMPLETED' | 'FAILED' = 'COMPLETED',
  error?: string,
) {
  await captureObserverSnapshot(runId).catch(() => undefined);
  await authDb()`UPDATE observer_runs SET status=${status},completed_at=now(),error=${error?.slice(0, 1000) ?? null} WHERE id=${runId}`;
}

export async function observerReport(runId: string, replayThresholds?: NotificationThresholds) {
  const sql = authDb();
  const [run] = await sql`SELECT * FROM observer_runs WHERE id=${runId}`;
  if (!run) return null;
  const items =
    await sql`SELECT i.*,s.name AS source_name FROM observer_run_items i JOIN content_sources s ON s.id=i.source_id WHERE i.run_id=${runId} ORDER BY i.detection_time DESC`;
  const events: any[] =
    await sql`SELECT e.*,s.publication_state,s.status AS story_status,s.first_reported_at,s.hot_read_until,s.cluster_reason,s.source_item_count,s.publisher_count,s.independent_source_count,pd.reason AS publication_decision_reason,
    EXISTS(
      SELECT 1 FROM story_evidence se
      JOIN content_sources cs ON cs.id=se.source_id
      WHERE se.story_id=e.story_id AND (cs.metadata->>'platform'='YOUTUBE' OR cs.fetch_strategy='YOUTUBE_WEBSUB')
    ) AS has_video_source
    FROM observer_run_events e JOIN canonical_stories s ON s.id=e.story_id
    LEFT JOIN story_publication_decisions pd ON pd.story_id=e.story_id AND pd.story_version=e.story_version
    WHERE e.run_id=${runId} ORDER BY e.captured_at DESC`;
  const thresholds = replayThresholds ?? (run.thresholds as NotificationThresholds);
  const evaluated = events.map((event) => {
    const sources = event.sources as Array<{ tier: string; type: string }>;
    const tier = Math.min(3, ...sources.map((source) => tierFor(source.tier))) as MonitoringTier;
    const official = sources.some((source) =>
      ['OFFICIAL_TEAM', 'NFL_OFFICIAL'].includes(source.type),
    );
    const decision = evaluateObserverNotification({
      score: Number(event.score),
      tier,
      official,
      confirmedTransaction:
        ['TRADE', 'SIGNING', 'RELEASE', 'TRANSACTION'].includes(event.category) &&
        (official ||
          new Set(
            sources
              .filter((source) => source.tier !== 'C')
              .map((source: any) => observerPublisherKey(source)),
          ).size >= 2),
      materialUpdate: event.story_version > 1,
      alreadyNotified: false,
      thresholds,
    });
    return { ...event, replayDecision: decision };
  });
  const latestByStory = new Map<string, any>();
  for (const event of evaluated) {
    if (!latestByStory.has(event.story_id)) latestByStory.set(event.story_id, event);
  }
  const publishable = [...latestByStory.values()]
    .filter(
      (event) =>
        ['PUBLISHED', 'AUTO_PUBLISHED'].includes(event.publication_state) &&
        Number(event.confidence) >= 80 &&
        event.story_status !== 'HOLDING' &&
        Array.isArray(event.sources) &&
        event.sources.length > 0,
    )
    .sort(
      (left, right) =>
        Number(right.story_status === 'BREAKING') - Number(left.story_status === 'BREAKING') ||
        Number(right.importance_score) - Number(left.importance_score) ||
        new Date(right.captured_at).getTime() - new Date(left.captured_at).getTime(),
    );
  const threeAndOutIds = new Set(
    publishable.length >= 3 ? publishable.slice(0, 3).map((event) => event.story_id) : [],
  );
  const beatIds = new Set(
    publishable
      .filter((event) => !threeAndOutIds.has(event.story_id))
      .slice(0, 24)
      .map((event) => event.story_id),
  );
  const replayed = evaluated.map((event) => {
    const isLatest = latestByStory.get(event.story_id) === event;
    const inThreeAndOut = isLatest && threeAndOutIds.has(event.story_id);
    const inBeat = isLatest && beatIds.has(event.story_id);
    const hotReadUntil = event.hot_read_until ? new Date(event.hot_read_until).getTime() : 0;
    const isHotRead =
      inBeat && hotReadUntil > 0 && new Date(event.captured_at).getTime() < hotReadUntil;
    const isVideo =
      Boolean(event.has_video_source) ||
      event.category === 'VIDEO' ||
      event.proposed_story?.filmRoomEligible === true;
    const publicationReason =
      event.publication_state === 'REVIEW_REQUIRED'
        ? (event.publication_decision_reason ??
          'Pending corroboration or editorial review before appearing publicly.')
        : event.publication_state === 'REJECTED'
          ? 'Publishing policy rejected this event.'
          : !isLatest
            ? 'A newer version of this event superseded it.'
            : 'Not selected for this surface.';
    return {
      ...event,
      outcomes: {
        notificationRecord: {
          action:
            inBeat && (isHotRead || event.replayDecision.decision === 'PUSH')
              ? 'WOULD_CREATE'
              : 'WOULD_NOT_CREATE',
          reason:
            inBeat && (isHotRead || event.replayDecision.decision === 'PUSH')
              ? event.story_version > 1
                ? 'Material canonical update qualifies for a new inbox record.'
                : 'Canonical Hot Read qualifies for a deduplicated inbox record.'
              : publicationReason,
        },
        push: {
          action: event.replayDecision.decision === 'PUSH' ? 'WOULD_SEND' : 'WOULD_NOT_SEND',
          reason: event.replayDecision.reason,
        },
        theBeat: {
          action: inBeat
            ? event.story_version > 1
              ? 'WOULD_UPDATE'
              : 'WOULD_CREATE'
            : 'WOULD_NOT_CREATE',
          reason: inBeat
            ? 'Selected for The Beat by the current surface rules.'
            : publicationReason,
        },
        hotRead: {
          action: isHotRead ? 'WOULD_CREATE' : 'WOULD_NOT_CREATE',
          reason: isHotRead
            ? `Would remain a Hot Read until ${new Date(hotReadUntil).toISOString()}.`
            : inBeat
              ? event.hot_read_until
                ? 'The two-hour Hot Read window had expired.'
                : 'This story never crossed the Hot Read corroboration threshold.'
              : publicationReason,
        },
        filmRoom: {
          action: isVideo ? 'WOULD_ADD' : 'WOULD_NOT_ADD',
          reason: isVideo
            ? 'A YouTube or video source makes this eligible for Film Room.'
            : 'No video source was attached to this event.',
        },
        threeAndOut: {
          action: inThreeAndOut ? 'WOULD_INCLUDE' : 'WOULD_NOT_INCLUDE',
          reason: inThreeAndOut
            ? 'Ranked in the top three publishable team developments.'
            : publicationReason,
        },
      },
    };
  });
  const health =
    await sql`SELECT id,name,polling_tier,fetch_strategy,last_successful_at,last_item_at,failure_count,consecutive_failures,average_latency_ms,last_error FROM content_sources WHERE team_id=${run.team_id} OR league_wide=true ORDER BY consecutive_failures DESC,priority DESC`;
  const pushes = replayed.filter((event) => event.replayDecision.decision === 'PUSH');
  const countBy = (values: string[]) =>
    Object.fromEntries(
      [...new Set(values)].map((value) => [
        value,
        values.filter((candidate) => candidate === value).length,
      ]),
    );
  const itemsPerSource = countBy(items.map((item) => String(item.source_name)));
  const eventsByCategory = countBy(replayed.map((event: any) => String(event.category)));
  const suppressionReasons = countBy(
    replayed
      .filter((event) => event.replayDecision.decision !== 'PUSH')
      .map((event) => event.replayDecision.reason),
  );
  const tierContributions = { tier1: 0, tier2: 0, tier3: 0 };
  for (const item of items) {
    const key = `tier${item.source_tier}` as keyof typeof tierContributions;
    tierContributions[key] += 1;
  }
  const durationHours = Math.max(
    1 / 60,
    (new Date(run.completed_at ?? new Date()).getTime() - new Date(run.started_at).getTime()) /
      3_600_000,
  );
  const liveItems = items.filter(
    (item) => new Date(item.publication_time).getTime() >= new Date(run.started_at).getTime(),
  );
  const backfillItems = items.filter(
    (item) => new Date(item.publication_time).getTime() < new Date(run.started_at).getTime(),
  );
  const averageLatency = (rows: any[]) =>
    rows.length
      ? Math.round(
          rows.reduce((sum, row) => sum + Number(row.time_to_detection_ms), 0) / rows.length,
        )
      : 0;
  return {
    run,
    thresholds,
    summary: {
      totalItems: items.length,
      averageDetectionLatencyMs: items.length
        ? Math.round(
            items.reduce((sum, row) => sum + Number(row.time_to_detection_ms), 0) / items.length,
          )
        : 0,
      liveDetectionLatencyMs: averageLatency(liveItems),
      backfillDetectionLatencyMs: averageLatency(backfillItems),
      liveItems: liveItems.length,
      backfillItems: backfillItems.length,
      canonicalEvents: new Set(events.map((event) => event.story_id)).size,
      duplicatesMerged: Math.max(
        0,
        items.length - new Set(events.map((event) => event.story_id)).size,
      ),
      proposedNotifications: pushes.length,
      notificationCandidates: replayed.filter(
        (event) => event.replayDecision.decision === 'CANDIDATE',
      ).length,
      feedOnlyDecisions: replayed.filter((event) => event.replayDecision.decision === 'FEED_ONLY')
        .length,
      indexOnlyDecisions: replayed.filter((event) => event.replayDecision.decision === 'INDEX_ONLY')
        .length,
      notificationsSuppressed: replayed.filter(
        (event) => event.replayDecision.decision === 'SUPPRESSED',
      ).length,
      beatCreates: replayed.filter((event) => event.outcomes.theBeat.action === 'WOULD_CREATE')
        .length,
      beatUpdates: replayed.filter((event) => event.outcomes.theBeat.action === 'WOULD_UPDATE')
        .length,
      hotReadsCreated: replayed.filter((event) => event.outcomes.hotRead.action === 'WOULD_CREATE')
        .length,
      filmRoomAdds: replayed.filter((event) => event.outcomes.filmRoom.action === 'WOULD_ADD')
        .length,
      threeAndOutIncludes: replayed.filter(
        (event) => event.outcomes.threeAndOut.action === 'WOULD_INCLUDE',
      ).length,
      proposedPerHour: Number((pushes.length / durationHours).toFixed(2)),
      projectedPerUserPerDay: Number(((pushes.length / durationHours) * 24).toFixed(2)),
      itemsPerSource,
      eventsByCategory,
      tierContributions,
      sourceFailures: health.filter((source) => Number(source.consecutive_failures) > 0).length,
      suppressionReasons,
    },
    items,
    events: replayed,
    health,
  };
}
