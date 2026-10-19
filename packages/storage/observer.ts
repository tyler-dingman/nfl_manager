import { Storage } from './core';
import { D1EditorialIngestion } from './editorial-ingestion';
import { evaluateObserverNotification } from '../../src/features/monitoring/notification-policy';
import { MONITORING_THRESHOLDS } from '../../src/features/monitoring/config';
export class D1Observer {
  constructor(readonly s: Storage) {}
  async startObserverRun(team: string, hours: number, thresholds = MONITORING_THRESHOLDS) {
    const id = crypto.randomUUID(),
      now = Date.now(),
      end = new Date(now + hours * 3600000);
    await this.s
      .statement(
        "INSERT INTO app_observer_runs(id,team_id,status,started_at,scheduled_end_at,thresholds,created_at) VALUES(?,?,'RUNNING',?,?,?,?)",
        [id, team, now, end.getTime(), JSON.stringify(thresholds), now],
      )
      .run();
    return { id, scheduledEndAt: end };
  }
  async run(id: string) {
    const [r] = await this.s.rows<any>('SELECT * FROM app_observer_runs WHERE id=?', [id]);
    return r
      ? {
          ...r,
          thresholds: JSON.parse(r.thresholds),
          started_at: new Date(r.started_at),
          scheduled_end_at: new Date(r.scheduled_end_at),
          completed_at: r.completed_at == null ? null : new Date(r.completed_at),
        }
      : null;
  }
  async captureObserverSnapshot(id: string) {
    const run = await this.run(id);
    if (!run || run.status !== 'RUNNING') throw Error('Observer run is not active.');
    const repo = new D1EditorialIngestion(this.s);
    await this.s
      .statement(
        "INSERT INTO app_observer_items(run_id,candidate_id,source_id,source_tier,content_type,publication_time,detection_time,time_to_detection_ms) SELECT ?,c.id,c.source_id,CASE s.polling_tier WHEN 'A' THEN 1 WHEN 'B' THEN 2 ELSE 3 END,'ANALYSIS',c.published_at,c.discovered_at,max(0,c.discovered_at-c.published_at) FROM app_editorial_candidates c JOIN app_editorial_sources s ON s.id=c.source_id WHERE c.discovered_at>=? AND(s.team_id=? OR s.league_wide=1) ON CONFLICT DO NOTHING",
        [id, run.started_at.getTime(), run.team_id],
      )
      .run();
    const rows = await this.s.rows<any>(
      'SELECT v.*,s.first_reported_at,s.created_at AS story_created_at FROM app_editorial_versions v JOIN app_editorial_stories s ON s.id=v.story_id WHERE s.team_id=? AND v.created_at>=? ORDER BY v.version',
      [run.team_id, run.started_at.getTime()],
    );
    for (const row of rows) {
      if (
        (
          await this.s.rows(
            'SELECT 1 FROM app_observer_events WHERE run_id=? AND story_id=? AND story_version=?',
            [id, row.story_id, row.version],
          )
        ).length
      )
        continue;
      const p = await this.s.get<any>(row.object_hash),
        story = p.story,
        evidence = await repo.evidenceForStory(story.id),
        sources = evidence.map((e) => ({
          id: e.source.id,
          name: e.source.name,
          url: e.candidate.url,
          tier: e.source.pollingTier,
          type: e.source.sourceType,
          platform: String(e.source.metadata.platform ?? ''),
        })),
        bestTier = Math.min(
          3,
          ...sources.map((s) => (s.tier === 'A' ? 1 : s.tier === 'B' ? 2 : 3)),
        ) as 1 | 2 | 3,
        official = sources.some((s) => ['OFFICIAL_TEAM', 'NFL_OFFICIAL'].includes(s.type)),
        independent = new Set(
          sources
            .filter((s) => s.tier !== 'C')
            .map((s) =>
              s.name
                .toLowerCase()
                .replace(/\s+(rss|web|x|youtube)$/i, '')
                .trim(),
            ),
        ).size,
        score = Number(
          (
            story.importanceScore * 0.55 +
            story.confidenceScore * 0.3 +
            (bestTier === 1 ? 15 : bestTier === 2 ? 8 : 2)
          ).toFixed(2),
        ),
        prior = await this.s.rows(
          "SELECT 1 FROM app_observer_events WHERE run_id=? AND story_id=? AND notification_decision='PUSH' LIMIT 1",
          [id, story.id],
        ),
        decision = evaluateObserverNotification({
          score,
          tier: bestTier,
          official,
          confirmedTransaction:
            ['TRADE', 'SIGNING', 'RELEASE', 'TRANSACTION'].includes(story.storyType) &&
            (official || independent >= 2),
          materialUpdate: p.change !== 'TRIVIAL' && story.version > 1,
          alreadyNotified: !!prior.length,
          thresholds: run.thresholds,
        }),
        now = Date.now(),
        event = {
          run_id: id,
          story_id: story.id,
          story_version: story.version,
          event_creation_time: new Date(row.story_created_at).toISOString(),
          captured_at: new Date(now).toISOString(),
          category: story.storyType,
          confidence: story.confidenceScore,
          importance_score: story.importanceScore,
          score,
          sources,
          proposed_push: `${story.headline} — ${story.summary}`.slice(0, 220),
          proposed_story: {
            headline: story.headline,
            threeAndOutSummary: story.summary,
            whyItMatters: story.whyItMatters,
            attribution: sources.map((s) => ({ name: s.name, url: s.url })),
            sourceCount: sources.length,
            independentSourceCount: independent,
            clusterReason: story.clusterReason,
            filmRoomEligible:
              story.storyType === 'VIDEO' || sources.some((s) => s.platform === 'YOUTUBE'),
          },
          notification_decision: decision.decision,
          suppression_reason: decision.decision === 'PUSH' ? null : decision.reason,
          time_to_proposed_notification_ms: Math.max(0, now - row.first_reported_at),
        };
      await this.s
        .statement(
          'INSERT INTO app_observer_events(run_id,story_id,story_version,notification_decision,object_hash,captured_at) VALUES(?,?,?,?,?,?) ON CONFLICT DO NOTHING',
          [
            id,
            story.id,
            story.version,
            decision.decision,
            await this.s.put({ schema: 1, event }),
            now,
          ],
        )
        .run();
    }
    return {
      itemsCaptured: (
        await this.s.rows<any>('SELECT count(*) AS n FROM app_observer_items WHERE run_id=?', [id])
      )[0].n as number,
      eventsCaptured: (
        await this.s.rows<any>('SELECT count(*) AS n FROM app_observer_events WHERE run_id=?', [id])
      )[0].n as number,
    };
  }
  async completeObserverRun(
    id: string,
    status: 'COMPLETED' | 'FAILED' = 'COMPLETED',
    error?: string,
  ) {
    await this.captureObserverSnapshot(id).catch(() => undefined);
    await this.s
      .statement('UPDATE app_observer_runs SET status=?,completed_at=?,error=? WHERE id=?', [
        status,
        Date.now(),
        error?.slice(0, 1000) ?? null,
        id,
      ])
      .run();
  }
  async reportData(id: string) {
    const run = await this.run(id);
    if (!run) return null;
    const repo = new D1EditorialIngestion(this.s),
      items = (
        await this.s.rows<any>(
          'SELECT i.*,s.name AS source_name FROM app_observer_items i JOIN app_editorial_sources s ON s.id=i.source_id WHERE run_id=? ORDER BY detection_time DESC',
          [id],
        )
      ).map((i) => ({
        ...i,
        publication_time: new Date(i.publication_time).toISOString(),
        detection_time: new Date(i.detection_time).toISOString(),
      })),
      rows = await this.s.rows<any>(
        'SELECT * FROM app_observer_events WHERE run_id=? ORDER BY captured_at DESC',
        [id],
      ),
      events = await Promise.all(
        rows.map(async (r) => {
          const p = await this.s.get<any>(r.object_hash);
          if (
            p.schema !== 1 ||
            p.event.run_id !== id ||
            p.event.story_id !== r.story_id ||
            p.event.story_version !== r.story_version
          )
            throw Error('Observer event identity mismatch');
          const story = (await repo.storyById(r.story_id))!,
            [decision] = await this.s.rows<any>(
              'SELECT reason FROM app_editorial_decisions WHERE story_id=? AND story_version=?',
              [r.story_id, r.story_version],
            ),
            sources = await repo.evidenceForStory(story.id);
          return {
            ...p.event,
            publication_state: story.publicationState,
            story_status: story.status,
            first_reported_at: story.firstReportedAt,
            hot_read_until: story.hotReadUntil,
            cluster_reason: story.clusterReason,
            source_item_count: story.sourceItemCount,
            publisher_count: story.publisherCount,
            independent_source_count: story.independentSourceCount,
            publication_decision_reason: decision?.reason,
            has_video_source: sources.some((e) => e.source.metadata.platform === 'YOUTUBE'),
          };
        }),
      ),
      health = (await repo.sourceHealth()).filter(
        (r) => r.team_id === run.team_id || r.league_wide,
      );
    return { run, items, events, health };
  }
}
