import { packCanonical, expandCanonical } from './canonical-editorial';
import { digest, utf8 } from './core';
import { stageObjects } from './staged-objects';
import { applicationEnvironment } from '../../src/server/persistence/bindings';
import { socialNotificationBatch } from './social-outbox';
import { Storage, type Statement } from './core';
import { guardedBatch } from './atomic';
import { PublicEditorial } from './editorial';
import { selectPrimarySource, type StoryView } from '../../src/features/story-engine/public-story';
import type {
  ContentCandidate,
  RegisteredSource,
  StoryRecord,
  SynthesizedStory,
  MaterialChangeType,
} from '../../src/features/story-engine/types';
import type {
  PublishingDecision,
  PublishingOverride,
} from '../../src/features/story-engine/publishing-policy';
const time = (d: string | Date) => new Date(d).getTime();
const publisher = (s: RegisteredSource) =>
  s.name
    .toLowerCase()
    .replace(/\s+(rss|web|x|youtube)$/i, '')
    .trim();
export class D1EditorialIngestion {
  constructor(readonly s: Storage) {}
  async syncSource(source: RegisteredSource, force = false) {
    // Runtime polling state lives in SQL. Definition hashes must not change
    // just because registry synchronization runs at a different clock time.
    const definition = {
      ...source,
      nextCheckAt: new Date(0),
      etag: null,
      lastModified: null,
      lastCheckedAt: null,
      lastSuccessfulAt: null,
      failureCount: 0,
      lastError: null,
    };
    const value = { schema: 1, kind: 'SOURCE', source: definition };
    const expected = await digest(utf8.encode(JSON.stringify(value)));
    const prior = await this.s
      .statement(
        'SELECT object_hash,next_check_at,name,team_id,league_wide,source_type,polling_tier,priority,enabled,platform FROM app_editorial_sources WHERE id=?',
        [source.id],
      )
      .first<any>();
    const projection = {
      name: source.name,
      team_id: source.teamId,
      league_wide: source.leagueWide ? 1 : 0,
      source_type: source.sourceType,
      polling_tier: source.pollingTier,
      priority: source.priority,
      enabled: source.enabled ? 1 : 0,
      platform: String(source.metadata.platform ?? ''),
    };
    if (
      !force &&
      prior?.object_hash === expected &&
      Object.entries(projection).every(([key, value]) => prior[key] === value)
    ) {
      await this.s.get(expected);
      return;
    }
    const hash = await this.s.put(value);
    await this.s
      .statement(
        'INSERT INTO app_editorial_sources(id,name,team_id,league_wide,source_type,polling_tier,priority,enabled,platform,object_hash,next_check_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,team_id=excluded.team_id,league_wide=excluded.league_wide,source_type=excluded.source_type,polling_tier=excluded.polling_tier,priority=excluded.priority,enabled=excluded.enabled,platform=excluded.platform,object_hash=excluded.object_hash,next_check_at=CASE WHEN ? THEN excluded.next_check_at ELSE app_editorial_sources.next_check_at END,updated_at=excluded.updated_at',
        [
          source.id,
          source.name,
          source.teamId,
          source.leagueWide ? 1 : 0,
          source.sourceType,
          source.pollingTier,
          source.priority,
          source.enabled ? 1 : 0,
          String(source.metadata.platform ?? ''),
          hash,
          time(source.nextCheckAt),
          Date.now(),
          force ? 1 : 0,
        ],
      )
      .run();
  }
  async sourceById(id: string): Promise<RegisteredSource | null> {
    const [r] = await this.s.rows<any>('SELECT * FROM app_editorial_sources WHERE id=?', [id]);
    if (!r) return null;
    const p = await this.s.get<any>(r.object_hash);
    if (p.schema !== 1 || p.kind !== 'SOURCE' || p.source.id !== id)
      throw Error('Source identity mismatch');
    return {
      ...p.source,
      nextCheckAt: new Date(r.next_check_at),
      lastCheckedAt: r.last_checked_at == null ? null : new Date(r.last_checked_at),
      lastSuccessfulAt: r.last_successful_at == null ? null : new Date(r.last_successful_at),
      etag: r.etag,
      lastModified: r.last_modified,
      failureCount: r.failure_count,
      lastError: r.last_error,
    };
  }
  async dueSources(now = new Date(), limit = 50, team?: string, group?: 'standard' | 'video') {
    const rows = await this.s.rows<any>(
      "SELECT id FROM app_editorial_sources WHERE enabled=1 AND next_check_at<=? AND(? IS NULL OR team_id=? OR league_wide=1) AND(? IS NULL OR CASE WHEN ?='video' THEN(source_type='YOUTUBE' OR platform='YOUTUBE') ELSE(source_type<>'YOUTUBE' AND coalesce(platform,'')<>'YOUTUBE') END) ORDER BY priority DESC,next_check_at LIMIT ?",
      [now.getTime(), team ?? null, team ?? null, group ?? null, group ?? null, limit],
    );
    return Promise.all(rows.map((r) => this.sourceById(r.id))) as Promise<RegisteredSource[]>;
  }
  async enqueueJob(type: string, key: string, payload: object) {
    return Boolean(
      await this.s
        .statement(
          'INSERT INTO app_editorial_jobs(id,job_type,idempotency_key,payload,available_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(idempotency_key) DO NOTHING RETURNING id',
          [
            crypto.randomUUID(),
            type,
            key,
            JSON.stringify(payload),
            Date.now(),
            Date.now(),
            Date.now(),
          ],
        )
        .first(),
    );
  }
  async claimJob(worker: string, team?: string, group?: 'standard' | 'video') {
    const now = Date.now();
    const ready = await this.s
      .statement(
        "SELECT 1 FROM app_editorial_jobs WHERE (status IN('PENDING','FAILED') OR(status='RUNNING' AND locked_at<?)) AND available_at<=? AND attempts<max_attempts LIMIT 1",
        [now - 300000, now],
      )
      .first();
    if (!ready) return null;
    worker = worker + ':' + crypto.randomUUID();
    const [row] = await this.s.rows<any>(
      `UPDATE app_editorial_jobs SET status='RUNNING',attempts=attempts+1,locked_at=?,locked_by=?,updated_at=? WHERE id=(SELECT j.id FROM app_editorial_jobs j LEFT JOIN app_editorial_candidates c ON c.id=json_extract(j.payload,'$.candidateId') LEFT JOIN app_editorial_sources s ON s.id=CASE WHEN j.job_type='SOURCE_FETCH' THEN json_extract(j.payload,'$.sourceId') ELSE c.source_id END WHERE (j.status IN('PENDING','FAILED') OR(j.status='RUNNING' AND j.locked_at<?)) AND j.available_at<=? AND j.attempts<j.max_attempts AND(? IS NULL OR(j.job_type='SOURCE_FETCH' AND(s.team_id=? OR s.league_wide=1)) OR(j.job_type='CANDIDATE_PROCESS' AND EXISTS(SELECT 1 FROM json_each(c.teams) WHERE value=?))) AND(? IS NULL OR CASE WHEN ?='video' THEN(s.source_type='YOUTUBE' OR s.platform='YOUTUBE') ELSE(s.source_type<>'YOUTUBE' AND coalesce(s.platform,'')<>'YOUTUBE') END) ORDER BY CASE WHEN j.job_type='SOURCE_FETCH' THEN 0 ELSE 1 END,c.published_at DESC,j.available_at,j.created_at LIMIT 1) RETURNING *`,
      [
        now,
        worker,
        now,
        now - 300000,
        now,
        team ?? null,
        team ?? null,
        team ?? null,
        group ?? null,
        group ?? null,
      ],
    );
    return row
      ? { ...row, payload: JSON.parse(row.payload), locked_at: new Date(row.locked_at) }
      : null;
  }
  async finishJob(id: string, worker?: string) {
    await this.s
      .statement(
        "UPDATE app_editorial_jobs SET status='COMPLETED',locked_at=NULL,locked_by=NULL,updated_at=? WHERE id=? AND locked_by=?",
        [Date.now(), id, worker ?? null],
      )
      .run();
  }
  async failJob(id: string, error: string, delay: number, worker?: string) {
    await this.s
      .statement(
        "UPDATE app_editorial_jobs SET status=CASE WHEN attempts>=max_attempts THEN 'DEAD' ELSE 'FAILED' END,last_error=?,available_at=?,locked_at=NULL,locked_by=NULL,updated_at=? WHERE id=? AND locked_by=?",
        [error.slice(0, 1000), Date.now() + delay * 1000, Date.now(), id, worker ?? null],
      )
      .run();
  }
  async markSourceSuccess(
    source: RegisteredSource,
    etag: string | null,
    modified: string | null,
    next: Date,
    latency?: number,
    last?: Date | null,
  ) {
    await this.s
      .statement(
        'UPDATE app_editorial_sources SET etag=?,last_modified=?,last_checked_at=?,last_successful_at=?,last_item_at=coalesce(?,last_item_at),next_check_at=?,failure_count=0,consecutive_failures=0,average_latency_ms=CASE WHEN ? IS NULL THEN average_latency_ms ELSE(coalesce(average_latency_ms,0)*request_count+?)/(request_count+1) END,request_count=request_count+1,last_error=NULL,updated_at=? WHERE id=?',
        [
          etag,
          modified,
          Date.now(),
          Date.now(),
          last?.getTime() ?? null,
          next.getTime(),
          latency ?? null,
          latency ?? null,
          Date.now(),
          source.id,
        ],
      )
      .run();
  }
  async markSourceFailure(source: RegisteredSource, error: string, next: Date, latency?: number) {
    await this.s
      .statement(
        'UPDATE app_editorial_sources SET last_checked_at=?,next_check_at=?,failure_count=failure_count+1,consecutive_failures=consecutive_failures+1,average_latency_ms=CASE WHEN ? IS NULL THEN average_latency_ms ELSE(coalesce(average_latency_ms,0)*request_count+?)/(request_count+1) END,request_count=request_count+1,last_error=?,updated_at=? WHERE id=?',
        [
          Date.now(),
          next.getTime(),
          latency ?? null,
          latency ?? null,
          error.slice(0, 1000),
          Date.now(),
          source.id,
        ],
      )
      .run();
  }
  async saveCandidate(c: ContentCandidate) {
    if (
      await this.s
        .statement(
          'SELECT id FROM app_storage_candidate_receipts WHERE canonical_url=? OR (source_id=? AND external_id=?)',
          [c.url, c.sourceId, c.externalId],
        )
        .first()
    )
      return undefined;
    // Match the existing UNIQUE constraints before allocating an immutable object.
    // The INSERT still arbitrates races; a retry must not upload an orphan blob.
    if (
      await this.s
        .statement(
          'SELECT id FROM app_editorial_candidates WHERE id=? OR canonical_url=? OR (source_id=? AND external_id=?) LIMIT 1',
          [c.id ?? null, c.url, c.sourceId, c.externalId],
        )
        .first()
    )
      return undefined;
    const id = c.id ?? crypto.randomUUID(),
      hash = await this.s.put({ schema: 1, kind: 'CANDIDATE', candidate: { ...c, id } });
    const row = await this.s
      .statement(
        'INSERT INTO app_editorial_candidates(id,source_id,external_id,canonical_url,fingerprint,published_at,discovered_at,teams,status,object_hash) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING RETURNING id',
        [
          id,
          c.sourceId,
          c.externalId,
          c.url,
          c.fingerprint,
          time(c.publishedAt),
          time(c.discoveredAt),
          JSON.stringify(c.candidateTeams),
          c.status,
          hash,
        ],
      )
      .first<any>();
    return row?.id as string | undefined;
  }
  async candidateById(id: string): Promise<ContentCandidate | null> {
    const [r] = await this.s.rows<any>('SELECT * FROM app_editorial_candidates WHERE id=?', [id]);
    if (!r) return null;
    const p = await this.s.get<any>(r.object_hash);
    if (
      p.schema !== 1 ||
      p.kind !== 'CANDIDATE' ||
      p.candidate.id !== id ||
      p.candidate.sourceId !== r.source_id
    )
      throw Error('Candidate identity mismatch');
    return { ...p.candidate, status: r.status };
  }
  async setCandidateStatus(id: string, status: string, reason?: string) {
    await this.s
      .statement(
        'UPDATE app_editorial_candidates SET status=?,rejection_reason=? WHERE id=? AND (status IS NOT ? OR rejection_reason IS NOT ?)',
        [status, reason ?? null, id, status, reason ?? null],
      )
      .run();
  }
  async storyById(id: string): Promise<StoryRecord | null> {
    const [r] = await this.s.rows<any>('SELECT * FROM app_editorial_stories WHERE id=?', [id]);
    if (!r) return null;
    const p = await this.s.get<any>(r.object_hash);
    const story = await expandCanonical(this.s, p, 'story');
    if (story.id !== id || story.version !== r.version)
      throw Error('Story identity/version mismatch');
    return story;
  }
  async revisionByVersion(id: string, version: number) {
    const [row] = await this.s.rows<any>(
      'SELECT object_hash FROM app_editorial_versions WHERE story_id=? AND version=?',
      [id, version],
    );
    if (!row) return null;
    const value = await this.s.get<any>(row.object_hash);
    if (value.schema === 1) {
      if (value.story?.id !== id || value.story?.version !== version)
        throw Error('Revision identity mismatch');
      return value;
    }
    if (value.schema !== 2 || value.kind !== 'CANONICAL_REVISION')
      throw Error('Invalid canonical revision');
    const story = await expandCanonical(this.s, await this.s.get(value.bodyHash), 'story');
    if (story.id !== id || story.version !== version) throw Error('Revision identity mismatch');
    return {
      schema: 1,
      story,
      synth: await expandCanonical(this.s, value.synthEnvelope, 'synth'),
      change: value.change,
      evidenceIds: value.evidenceIds,
    };
  }
  async recentStories(teams: string[], since: Date) {
    const rows = await this.s.rows<any>(
      'SELECT id FROM app_editorial_stories WHERE last_meaningful_update_at>=? AND(team_id IS NULL OR team_id IN(SELECT value FROM json_each(?)))',
      [since.getTime(), JSON.stringify(teams)],
    );
    return Promise.all(rows.map((r) => this.storyById(r.id))) as Promise<StoryRecord[]>;
  }
  async publishedStoryCountToday(team: string) {
    const [r] = await this.s.rows<any>(
      "SELECT count(*) AS n FROM app_editorial_stories WHERE team_id=? AND created_at>=? AND publication_state IN('PUBLISHED','AUTO_PUBLISHED')",
      [team, new Date().setUTCHours(0, 0, 0, 0)],
    );
    return r.n as number;
  }
  async storyIdsWithEvidenceSince(team: string, since: Date) {
    return (
      await this.s.rows<any>(
        'SELECT DISTINCT s.id FROM app_editorial_stories s JOIN app_editorial_evidence e ON e.story_id=s.id JOIN app_editorial_candidates c ON c.id=e.candidate_id WHERE s.team_id=? AND c.published_at>=? ORDER BY s.id',
        [team, since.getTime()],
      )
    ).map((r) => String(r.id));
  }
  private async resolvedEvidence(id: string) {
    const rows = await this.s.rows<any>(
      `SELECT e.id,e.candidate_id,e.source_id,c.object_hash candidate_hash,c.source_id candidate_source_id,c.status candidate_status,s.object_hash source_hash,s.next_check_at,s.last_checked_at,s.last_successful_at,s.etag,s.last_modified,s.failure_count,s.last_error FROM app_editorial_evidence e LEFT JOIN app_editorial_candidates c ON c.id=e.candidate_id LEFT JOIN app_editorial_sources s ON s.id=e.source_id WHERE e.story_id=? ORDER BY e.first_seen_at,e.id`,
      [id],
    );
    if (rows.some((row) => !row.candidate_hash || !row.source_hash))
      throw Error('Missing editorial evidence dependency');
    await this.s.objects.prefetch?.(
      [...new Set(rows.flatMap((r) => [r.candidate_hash, r.source_hash]))].map(
        (hash) => `application/v1/${hash}`,
      ),
    );
    return Promise.all(
      rows.map(async (row) => {
        const [candidate, source] = await Promise.all([
          this.s.get<any>(row.candidate_hash),
          this.s.get<any>(row.source_hash),
        ]);
        if (
          candidate.schema !== 1 ||
          candidate.kind !== 'CANDIDATE' ||
          candidate.candidate.id !== row.candidate_id ||
          candidate.candidate.sourceId !== row.source_id ||
          candidate.candidate.sourceId !== row.candidate_source_id ||
          source.schema !== 1 ||
          source.kind !== 'SOURCE' ||
          source.source.id !== row.source_id
        )
          throw Error('Editorial evidence identity mismatch');
        return {
          id: row.id,
          candidate: { ...candidate.candidate, status: row.candidate_status } as ContentCandidate,
          source: {
            ...source.source,
            nextCheckAt: new Date(row.next_check_at),
            lastCheckedAt: row.last_checked_at == null ? null : new Date(row.last_checked_at),
            lastSuccessfulAt:
              row.last_successful_at == null ? null : new Date(row.last_successful_at),
            etag: row.etag,
            lastModified: row.last_modified,
            failureCount: row.failure_count,
            lastError: row.last_error,
          } as RegisteredSource,
        };
      }),
    );
  }
  async evidenceForStory(id: string) {
    return (await this.resolvedEvidence(id)).map(({ candidate, source }) => ({
      candidate,
      source,
    }));
  }
  async activePublishingOverride(id: string): Promise<PublishingOverride> {
    const [r] = await this.s.rows<any>(
      "SELECT action FROM app_story_overrides WHERE story_id=? AND active=1 AND surface='PUBLIC' AND(expires_at IS NULL OR expires_at>?) ORDER BY created_at DESC LIMIT 1",
      [id, Date.now()],
    );
    return ['HIDE', 'FORCE_PUBLISH', 'FORCE_REVIEW'].includes(r?.action) ? r.action : null;
  }
  async commit(
    story: StoryRecord,
    expected: number,
    synth: SynthesizedStory | null,
    change: MaterialChangeType,
    decision: PublishingDecision | undefined,
    evidence: { id: string; candidate: ContentCandidate; source: RegisteredSource }[],
    newEvidence?: { id: string; candidate: ContentCandidate; source: RegisteredSource },
  ) {
    const prepared = stageObjects(this.s);
    const now = Date.now(),
      hash = await prepared.storage.put(await packCanonical(prepared.storage, story, 'story')),
      writes: Statement[] = [],
      guards: { sql: string; values: unknown[] }[] = [];
    if (expected)
      guards.push({
        sql: 'EXISTS(SELECT 1 FROM app_editorial_stories WHERE id=? AND version=? AND object_hash=?)',
        values: [
          story.id,
          expected,
          (
            await prepared.storage.rows<any>(
              'SELECT object_hash FROM app_editorial_stories WHERE id=?',
              [story.id],
            )
          )[0]?.object_hash,
        ],
      });
    else
      guards.push({
        sql: 'NOT EXISTS(SELECT 1 FROM app_editorial_stories WHERE id=?)',
        values: [story.id],
      });
    writes.push(
      prepared.storage.statement(
        'INSERT INTO app_editorial_stories(id,team_id,story_type,publication_state,status,version,object_hash,first_reported_at,last_meaningful_update_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET publication_state=excluded.publication_state,status=excluded.status,version=excluded.version,object_hash=excluded.object_hash,last_meaningful_update_at=excluded.last_meaningful_update_at,updated_at=excluded.updated_at',
        [
          story.id,
          story.teamId,
          story.storyType,
          story.publicationState,
          story.status,
          story.version,
          hash,
          time(story.firstReportedAt),
          time(story.lastMeaningfulUpdateAt),
          now,
          now,
        ],
      ),
    );
    if (newEvidence) {
      const e = newEvidence;
      guards.push({
        sql: 'NOT EXISTS(SELECT 1 FROM app_editorial_evidence WHERE candidate_id=? AND story_id<>?)',
        values: [e.candidate.id, story.id],
      });
      writes.push(
        prepared.storage.statement(
          'INSERT INTO app_editorial_evidence(id,story_id,candidate_id,source_id,first_seen_at) VALUES(?,?,?,?,?) ON CONFLICT(story_id,candidate_id) DO NOTHING',
          [e.id, story.id, e.candidate.id, e.source.id, now],
        ),
        prepared.storage.statement(
          "UPDATE app_editorial_candidates SET status='CLUSTERED' WHERE id=?",
          [e.candidate.id],
        ),
      );
    }
    if (synth) {
      const versionHash = await prepared.storage.put({
        schema: 2,
        kind: 'CANONICAL_REVISION',
        bodyHash: hash,
        synthEnvelope: await packCanonical(prepared.storage, synth, 'synth'),
        change,
        evidenceIds: evidence.map((e) => e.id),
      });
      writes.push(
        prepared.storage.statement(
          'INSERT INTO app_editorial_versions(id,story_id,version,object_hash,created_at) VALUES(?,?,?,?,?)',
          [crypto.randomUUID(), story.id, story.version, versionHash, now],
        ),
      );
      if (decision)
        writes.push(
          prepared.storage.statement(
            'INSERT INTO app_editorial_decisions(id,story_id,story_version,action,reason,confidence,created_at) VALUES(?,?,?,?,?,?,?)',
            [
              crypto.randomUUID(),
              story.id,
              story.version,
              decision.action,
              decision.reason,
              decision.confidence,
              now,
            ],
          ),
        );
      const eventType = expected ? 'StoryUpdated' : 'StoryCreated',
        eventId = crypto.randomUUID(),
        payload = { change };
      writes.push(
        prepared.storage.statement(
          'INSERT INTO app_editorial_events(id,event_type,story_id,team_id,story_version,idempotency_key,object_hash,occurred_at) VALUES(?,?,?,?,?,?,?,?)',
          [
            eventId,
            eventType,
            story.id,
            story.teamId,
            story.version,
            `${eventType}:${story.id}:${story.version}`,
            await prepared.storage.put({ schema: 1, payload }),
            now,
          ],
        ),
        ...(story.teamId
          ? [
              prepared.storage.statement(
                'INSERT INTO app_public_wire(id,event_type,story_id,team_id,story_version,object_hash,occurred_at) VALUES(?,?,?,?,?,?,?)',
                [
                  eventId,
                  eventType,
                  story.id,
                  story.teamId,
                  story.version,
                  await prepared.storage.put({
                    id: eventId,
                    eventType,
                    storyId: story.id,
                    storyVersion: story.version,
                    occurredAt: new Date(now).toISOString(),
                    payload,
                  }),
                  now,
                ],
              ),
            ]
          : []),
      );
    }
    if (synth) {
      const prior = expected ? await this.storyById(story.id) : null;
      const eventTypes = [
        ...(synth.status === 'BREAKING' && prior?.status !== 'BREAKING'
          ? ['StoryBecameBreaking']
          : []),
        ...(synth.status === 'RESOLVED' && prior?.status !== 'RESOLVED' ? ['StoryResolved'] : []),
        ...(prior && Math.abs(prior.importanceScore - story.importanceScore) >= 10
          ? ['StoryImportanceChanged']
          : []),
      ];
      for (const eventType of eventTypes) {
        const id = crypto.randomUUID(),
          payload = { change, reason: decision?.reason ?? change };
        const event = {
          id,
          eventType,
          storyId: story.id,
          storyVersion: story.version,
          occurredAt: new Date(now).toISOString(),
          payload,
        };
        const object = await prepared.storage.put(event);
        writes.push(
          prepared.storage.statement(
            'INSERT INTO app_editorial_events(id,event_type,story_id,team_id,story_version,idempotency_key,object_hash,occurred_at) VALUES(?,?,?,?,?,?,?,?)',
            [
              id,
              eventType,
              story.id,
              story.teamId,
              story.version,
              `${eventType}:${story.id}:${story.version}`,
              object,
              now,
            ],
          ),
        );
        if (story.teamId)
          writes.push(
            prepared.storage.statement(
              'INSERT INTO app_public_wire(id,event_type,story_id,team_id,story_version,object_hash,occurred_at) VALUES(?,?,?,?,?,?,?)',
              [id, eventType, story.id, story.teamId, story.version, object, now],
            ),
          );
      }
      if (
        story.teamId &&
        story.publicationState === 'AUTO_PUBLISHED' &&
        change !== 'TRIVIAL' &&
        applicationEnvironment().OBSERVER_MODE !== 'true'
      ) {
        const followers = await prepared.storage.rows<any>(
          "SELECT u.id FROM app_users u JOIN app_settings p ON p.user_id=u.id WHERE u.status='ACTIVE' AND json_extract(p.preferences_json,'$.preferredTeamId')=? AND NOT EXISTS(SELECT 1 FROM app_notification_preferences np WHERE np.user_id=u.id AND np.category IN('BREAKING_NEWS','BREAKING','HOT_READ') AND np.channel='IN_APP' AND np.enabled=0)",
          [story.teamId],
        );
        for (let offset = 0; offset < followers.length; offset += 250) {
          const recipients = followers.slice(offset, offset + 250);
          writes.push(
            await socialNotificationBatch(
              prepared.storage,
              recipients[0].id,
              `canonical:${story.id}:${story.version}:${offset}`,
              recipients.map((u) => ({
                user: u.id,
                input: {
                  eventId: `canonical:${story.id}:${story.version}`,
                  dedupeKey: `canonical:${story.id}:${story.version}`,
                  teamAbbr: story.teamId!,
                  title: story.headline,
                  body: story.summary,
                  deepLink: `/the-beat?team=${story.teamId}&story=${story.id}`,
                  contentId: story.id,
                  contentType: 'BEAT_STORY',
                  type: decision?.breaking ? 'BREAKING' : 'HOT_READ',
                  category: decision?.breaking ? 'BREAKING' : 'HOT_READ',
                  priority: decision?.breaking || story.importanceScore >= 85 ? 'HIGH' : 'NORMAL',
                  pushEligible: Boolean(decision?.breaking || story.importanceScore >= 85),
                  metadata: { storyVersion: story.version, reason: decision?.reason ?? change },
                },
              })),
            ),
          );
        }
      }
    }
    const sources = evidence.map((e, i) => ({
        id: e.id,
        name: e.source.name,
        url: e.candidate.url,
        publishedAt: e.candidate.publishedAt,
        official: ['OFFICIAL_TEAM', 'NFL_OFFICIAL'].includes(e.source.sourceType),
        original: i === 0,
      })),
      view: StoryView = {
        id: story.id,
        teamId: story.teamId!,
        storyType: story.storyType,
        headline: story.headline,
        shortSummary: story.summary,
        whatHappened: story.whatHappened,
        whyItMatters: story.whyItMatters,
        whatsNext: story.whatsNext,
        status: story.status,
        importanceScore: story.importanceScore,
        confidenceScore: story.confidenceScore,
        firstReportedAt: new Date(story.firstReportedAt).toISOString(),
        lastMeaningfulUpdateAt: new Date(story.lastMeaningfulUpdateAt).toISOString(),
        sources,
        primarySource: selectPrimarySource(sources),
        version: story.version,
        sourceItemCount: story.sourceItemCount,
        publisherCount: story.publisherCount,
        independentSourceCount: story.independentSourceCount,
        hotReadUntil: story.hotReadUntil ? new Date(story.hotReadUntil).toISOString() : null,
        clusterReason: story.clusterReason,
      };
    // Evidence-only enrichment can change public attribution without changing text version.
    // It remains private until a material revision: immutable public version never mutates.
    if (
      synth &&
      story.teamId &&
      evidence.some(
        (e) => e.source.sourceType !== 'YOUTUBE' && e.source.metadata.platform !== 'YOUTUBE',
      )
    )
      writes.push(
        ...(await new PublicEditorial(prepared.storage).prepare(
          view,
          story.publicationState,
          undefined,
          guards,
        )),
      );
    await prepared.flush();
    await guardedBatch(prepared.storage, guards, writes, 'Editorial version conflict');
    return story.version;
  }
  async createStory(
    candidate: ContentCandidate,
    source: RegisteredSource,
    synth: SynthesizedStory,
    publication: string,
    change: MaterialChangeType,
    decision?: PublishingDecision,
    reason = 'NEW CANONICAL EVENT: no existing same-event cluster matched.',
  ) {
    const now = new Date().toISOString(),
      hot = publication === 'AUTO_PUBLISHED',
      story: StoryRecord = {
        id: crypto.randomUUID(),
        teamId: candidate.candidateTeams[0] ?? source.teamId,
        storyType: candidate.storyType,
        ...synth,
        publicationState: publication as any,
        entities: candidate.entities,
        firstReportedAt: candidate.publishedAt,
        lastMeaningfulUpdateAt: candidate.publishedAt,
        version: 1,
        sourceItemCount: 1,
        publisherCount: 1,
        independentSourceCount: source.pollingTier === 'C' ? 0 : 1,
        hotReadQualifiedAt: hot ? now : null,
        hotReadUntil: hot ? new Date(Date.now() + 7200000).toISOString() : null,
        clusterReason: reason,
      },
      e = { id: crypto.randomUUID(), candidate, source };
    await this.commit(story, 0, synth, change, decision, [e], e);
    return story.id;
  }
  async attachEvidence(
    story: StoryRecord,
    candidate: ContentCandidate,
    source: RegisteredSource,
    synth: SynthesizedStory | null,
    publication: string | null,
    change: MaterialChangeType,
    decision?: PublishingDecision,
    reason?: string,
  ) {
    const prior = await this.resolvedEvidence(story.id),
      existing = prior.find((e) => e.candidate.id === candidate.id),
      e = { id: existing?.id ?? crypto.randomUUID(), candidate, source },
      evidence = [...prior];
    if (!existing) evidence.push(e);
    const hot = publication === 'AUTO_PUBLISHED' && !story.hotReadQualifiedAt,
      next: StoryRecord = {
        ...story,
        ...(synth ?? {}),
        publicationState: (publication ?? story.publicationState) as any,
        version: story.version + 1,
        sourceItemCount: evidence.length,
        publisherCount: new Set(evidence.map((e) => publisher(e.source))).size,
        independentSourceCount: new Set(
          evidence.filter((e) => e.source.pollingTier !== 'C').map((e) => publisher(e.source)),
        ).size,
        clusterReason: reason ?? story.clusterReason,
        lastMeaningfulUpdateAt: synth ? candidate.publishedAt : story.lastMeaningfulUpdateAt,
        hotReadQualifiedAt: hot ? new Date().toISOString() : story.hotReadQualifiedAt,
        hotReadUntil: hot ? new Date(Date.now() + 7200000).toISOString() : story.hotReadUntil,
      };
    if (existing && !synth) return story.version;
    const revision = synth ?? {
      headline: story.headline,
      summary: story.summary,
      whatHappened: story.whatHappened,
      whyItMatters: story.whyItMatters,
      whatsNext: story.whatsNext,
      status: story.status,
      importanceScore: story.importanceScore,
      confidenceScore: story.confidenceScore,
      claims: [],
    };
    return this.commit(
      next,
      story.version,
      revision,
      synth ? change : 'SOURCE_CONFIRMATION',
      decision,
      evidence,
      existing ? undefined : e,
    );
  }
  async promoteExistingStory(
    story: StoryRecord,
    synth: SynthesizedStory,
    decision: PublishingDecision,
  ) {
    const evidence = await this.resolvedEvidence(story.id),
      next = {
        ...story,
        ...synth,
        version: story.version + 1,
        publicationState: (decision.action === 'AUTO_PUBLISH'
          ? 'AUTO_PUBLISHED'
          : decision.action === 'REVIEW_REQUIRED'
            ? 'REVIEW_REQUIRED'
            : 'REJECTED') as StoryRecord['publicationState'],
        hotReadQualifiedAt: story.hotReadQualifiedAt ?? new Date().toISOString(),
        hotReadUntil: story.hotReadUntil ?? new Date(Date.now() + 7200000).toISOString(),
      };
    return this.commit(next, story.version, synth, 'SOURCE_CONFIRMATION', decision, evidence);
  }
  async filmRoomRows(team: string) {
    const rows = await this.s.rows<any>(
      "SELECT c.id,c.source_id FROM app_editorial_candidates c JOIN app_editorial_sources s ON s.id=c.source_id WHERE s.platform='YOUTUBE' AND c.status NOT IN('REJECTED','FAILED') AND(s.team_id=? OR EXISTS(SELECT 1 FROM json_each(c.teams) WHERE value=?)) ORDER BY c.published_at DESC,c.discovered_at DESC",
      [team, team],
    );
    return Promise.all(
      rows.map(async (r) => {
        const c = (await this.candidateById(r.id))!,
          source = (await this.sourceById(r.source_id))!;
        return {
          external_id: c.externalId,
          title: c.title,
          excerpt: c.excerpt,
          raw_text: c.text,
          published_at: c.publishedAt,
          discovered_at: c.discoveredAt,
          author: c.author,
          source_name: source.name,
          source_url: source.url,
          source_type: source.sourceType,
          reliability_score: source.reliabilityScore,
          source_metadata: source.metadata,
        };
      }),
    );
  }
  async sourceHealth() {
    return this.s.rows<any>(
      'SELECT * FROM app_editorial_sources ORDER BY consecutive_failures DESC,priority DESC',
    );
  }
  async reviewRequiredStories(limit = 50) {
    const rows = await this.s.rows<any>(
      "SELECT s.id,s.team_id,s.version,d.reason,d.created_at FROM app_editorial_stories s LEFT JOIN app_editorial_decisions d ON d.story_id=s.id AND d.story_version=s.version WHERE s.publication_state='REVIEW_REQUIRED' ORDER BY s.updated_at DESC LIMIT ?",
      [limit],
    );
    return Promise.all(
      rows.map(async (r) => {
        const story = (await this.storyById(r.id))!;
        return {
          ...r,
          headline: story.headline,
          summary: story.summary,
          status: story.status,
          confidence_score: story.confidenceScore,
          importance_score: story.importanceScore,
          sources: (await this.evidenceForStory(r.id)).map((e) => ({
            name: e.source.name,
            url: e.candidate.url,
          })),
        };
      }),
    );
  }
}
