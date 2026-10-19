type D1PreparedStatement = import('@cloudflare/workers-types/index.ts').D1PreparedStatement;
import { PayloadStore } from './payloads';
import { EditorialDatabase, canonicalUrl, hash, integer, json, text } from './database';
import { teamId } from './teams';
import type {
  Candidate,
  Cursor,
  Edition,
  Evidence,
  Page,
  RecordData,
  Source,
  SourceCheck,
  Story,
  Video,
} from './types';
const decode = <T>(row: { record_json: string }): T => JSON.parse(row.record_json) as T;
function teams(values: unknown): string[] {
  if (!Array.isArray(values) || values.length > 32) throw Error('Invalid team associations');
  return [...new Set(values.map(teamId))];
}
function pageArgs(limit: number, cursor?: Cursor) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw Error('Page limit must be 1–100');
  if (cursor) {
    integer(cursor.time);
    text(cursor.id);
  }
  return [
    cursor?.time ?? Number.MAX_SAFE_INTEGER,
    cursor?.time ?? Number.MAX_SAFE_INTEGER,
    cursor?.id ?? '\uffff',
  ];
}
function page<T>(
  rows: Array<{ record_json: string; id: string; time: number }>,
  limit: number,
): Page<T> {
  const more = rows.length > limit;
  const selected = rows.slice(0, limit),
    last = selected.at(-1);
  return {
    items: selected.map(decode<T>),
    nextCursor: more && last ? { time: last.time, id: last.id } : null,
  };
}
export class EditorialRepository {
  readonly payloads: PayloadStore;
  constructor(
    readonly db: EditorialDatabase,
    compact = true,
  ) {
    this.payloads = new PayloadStore(db, compact);
  }
  async upsertSource(source: Source) {
    text(source.id);
    text(source.name);
    canonicalUrl(source.url);
    integer(source.priority);
    integer(source.nextCheckAt);
    if (typeof source.enabled !== 'boolean' || typeof source.leagueWide !== 'boolean')
      throw Error('Invalid source booleans');
    if (source.teamId !== null) teamId(source.teamId);
    else if (!source.leagueWide) throw Error('Unscoped source');
    const associations = teams(source.teamIds);
    if (source.teamId && !associations.includes(source.teamId))
      throw Error('Primary source team must be associated');
    const definitionHash = await hash({
      ...source,
      nextCheckAt: undefined,
      lastSuccessfulAt: undefined,
    });
    const [prior] = await this.db.query<{ definition_hash: string }>(
      'source.lookup',
      'SELECT definition_hash FROM content_sources WHERE id=?',
      [source.id],
    );
    if (prior?.definition_hash === definitionHash) return { changed: false };
    const statements = [
      this.db.statement(
        `INSERT INTO content_sources(id,team_id,league_wide,enabled,platform,priority,next_check_at,definition_hash,record_json) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET team_id=excluded.team_id,league_wide=excluded.league_wide,enabled=excluded.enabled,platform=excluded.platform,priority=excluded.priority,definition_hash=excluded.definition_hash,record_json=json_set(excluded.record_json,'$.nextCheckAt',content_sources.next_check_at,'$.lastSuccessfulAt',content_sources.last_successful_at)`,
        [
          source.id,
          source.teamId,
          Number(source.leagueWide),
          Number(source.enabled),
          text(source.platform),
          source.priority,
          source.nextCheckAt,
          definitionHash,
          json(source),
        ],
      ),
      this.db.statement('DELETE FROM source_teams WHERE source_id=?', [source.id]),
      ...associations.map((t) =>
        this.db.statement('INSERT INTO source_teams(source_id,team_id) VALUES(?,?)', [
          source.id,
          t,
        ]),
      ),
    ];
    await this.db.batch('source.upsert', statements);
    return { changed: true };
  }
  async recordSourceCheck(check: SourceCheck) {
    text(check.id);
    text(check.sourceId);
    integer(check.attemptedAt);
    integer(check.nextCheckAt);
    if (typeof check.successful !== 'boolean') throw Error('Invalid check result');
    const checkToken = crypto.randomUUID();
    await this.db.batch('source.check', [
      this.db.statement(
        "INSERT INTO transaction_assertions(token,value) VALUES(?,CASE WHEN NOT EXISTS(SELECT 1 FROM archive_records WHERE kind='check' AND id=?) THEN 1 ELSE 0 END)",
        [checkToken, check.id],
      ),
      this.db.statement(
        'INSERT INTO source_checks(id,source_id,attempted_at,successful,record_json) VALUES(?,?,?,?,?)',
        [
          check.id,
          check.sourceId,
          check.attemptedAt,
          Number(check.successful),
          await this.payloads.store(check),
        ],
      ),
      this.db.statement(
        `INSERT INTO source_checkpoints(source_id,last_attempt_at,last_successful_at,etag,last_modified,cursor_json) VALUES(?,?,?,?,?,?) ON CONFLICT(source_id) DO UPDATE SET last_attempt_at=excluded.last_attempt_at,last_successful_at=CASE WHEN excluded.last_successful_at IS NOT NULL THEN max(COALESCE(source_checkpoints.last_successful_at,0),excluded.last_successful_at) ELSE source_checkpoints.last_successful_at END,etag=CASE WHEN ? THEN excluded.etag ELSE source_checkpoints.etag END,last_modified=CASE WHEN ? THEN excluded.last_modified ELSE source_checkpoints.last_modified END,cursor_json=CASE WHEN ? THEN excluded.cursor_json ELSE source_checkpoints.cursor_json END WHERE excluded.last_attempt_at>=source_checkpoints.last_attempt_at`,
        [
          check.sourceId,
          check.attemptedAt,
          check.successful ? check.attemptedAt : null,
          check.etag ?? null,
          check.lastModified ?? null,
          json(check.cursor ?? null),
          Number(check.successful && check.etag !== undefined),
          Number(check.successful && check.lastModified !== undefined),
          Number(check.successful && check.cursor !== undefined),
        ],
      ),
      this.db.statement(
        `UPDATE content_sources SET next_check_at=?,last_successful_at=(SELECT last_successful_at FROM source_checkpoints WHERE source_id=?),record_json=json_set(record_json,'$.nextCheckAt',?,'$.lastSuccessfulAt',(SELECT last_successful_at FROM source_checkpoints WHERE source_id=?)) WHERE id=? AND ?=(SELECT last_attempt_at FROM source_checkpoints WHERE source_id=?)`,
        [
          check.nextCheckAt,
          check.sourceId,
          check.nextCheckAt,
          check.sourceId,
          check.sourceId,
          check.attemptedAt,
          check.sourceId,
        ],
      ),
      this.db.unguard(checkToken),
    ]);
  }
  async sourcesForTeam(team: unknown): Promise<Source[]> {
    const t = teamId(team);
    const rows = await this.db.query<{ record_json: string }>(
      'source.team',
      `SELECT s.record_json FROM source_teams st JOIN content_sources s ON s.id=st.source_id WHERE st.team_id=? UNION SELECT record_json FROM content_sources WHERE league_wide=1`,
      [t],
    );
    return rows.map(decode<Source>);
  }
  async insertCandidate(
    input: Candidate,
    ownerEpoch = 1,
  ): Promise<{ candidate: Candidate; duplicate: boolean; revised: boolean }> {
    const normalizedUrl = canonicalUrl(input.canonicalUrl);
    const candidate = {
      ...input,
      ...(normalizedUrl !== input.canonicalUrl
        ? { originalUrl: input.originalUrl ?? input.canonicalUrl }
        : {}),
      canonicalUrl: normalizedUrl,
      teamIds: teams(input.teamIds),
    };
    [
      candidate.id,
      candidate.sourceId,
      candidate.externalId,
      candidate.fingerprint,
      candidate.status,
      candidate.title,
    ].forEach(text);
    integer(candidate.publishedAt);
    integer(candidate.discoveredAt);
    integer(ownerEpoch);
    const lookup = () =>
      this.db.query<{ id: string; fingerprint: string; record_json: string; revision: number }>(
        'candidate.identity',
        `SELECT id,fingerprint,record_json,revision FROM content_candidates WHERE source_id=? AND (external_id=? OR canonical_url=?)`,
        [candidate.sourceId, candidate.externalId, candidate.canonicalUrl],
      );
    const prior = await lookup();
    if (prior.length > 1) throw Error('External ID and URL resolve to different candidates');
    if (prior[0]?.fingerprint === candidate.fingerprint)
      return { candidate: decode<Candidate>(prior[0]), duplicate: true, revised: false };
    const token = crypto.randomUUID(),
      existing = prior[0],
      id = existing?.id ?? candidate.id,
      original = existing ? decode<Candidate>(existing) : null,
      record = {
        ...candidate,
        id,
        externalId: original?.externalId ?? candidate.externalId,
        discoveredAt: original?.discoveredAt ?? candidate.discoveredAt,
      },
      revision = (existing?.revision ?? 0) + 1;
    const first = existing
      ? this.db.statement(
          `UPDATE content_candidates SET canonical_url=?,fingerprint=?,status=?,published_at=?,record_json=?,revision=revision+1 WHERE id=? AND revision=?`,
          [
            candidate.canonicalUrl,
            candidate.fingerprint,
            candidate.status,
            candidate.publishedAt,
            await this.payloads.store(record),
            id,
            existing.revision,
          ],
        )
      : this.db.statement(
          `INSERT INTO content_candidates(id,source_id,external_id,canonical_url,fingerprint,status,published_at,discovered_at,record_json) VALUES(?,?,?,?,?,?,?,?,?)`,
          [
            id,
            candidate.sourceId,
            candidate.externalId,
            candidate.canonicalUrl,
            candidate.fingerprint,
            candidate.status,
            candidate.publishedAt,
            candidate.discoveredAt,
            await this.payloads.store(record),
          ],
        );
    try {
      await this.db.batch('candidate.commit', [
        first,
        this.db.guard(token),
        this.db.statement(
          'INSERT INTO content_candidate_revisions(candidate_id,revision,content_hash,observed_at,record_json) VALUES(?,?,?,?,?)',
          [
            id,
            revision,
            candidate.fingerprint,
            candidate.discoveredAt,
            await this.payloads.store(record),
          ],
        ),
        this.db.statement('DELETE FROM candidate_teams WHERE candidate_id=?', [id]),
        ...candidate.teamIds.map((t) =>
          this.db.statement('INSERT INTO candidate_teams(candidate_id,team_id) VALUES(?,?)', [
            id,
            t,
          ]),
        ),
        this.db.statement(
          `INSERT INTO ingestion_jobs(id,job_type,idempotency_key,status,source_id,candidate_id,available_at,owner_epoch,payload_json,created_at,updated_at) VALUES(?,'PROCESS_CANDIDATE',?,'PENDING',?,?,?,?,?,?,?)`,
          [
            crypto.randomUUID(),
            `candidate:${id}:${revision}`,
            candidate.sourceId,
            id,
            candidate.discoveredAt,
            ownerEpoch,
            json({ candidateId: id, revision }),
            candidate.discoveredAt,
            candidate.discoveredAt,
          ],
        ),
        this.db.unguard(token),
      ]);
    } catch (error) {
      const winner = await lookup();
      if (!existing && winner.length === 1 && winner[0].fingerprint === candidate.fingerprint)
        return { candidate: decode<Candidate>(winner[0]), duplicate: true, revised: false };
      throw error;
    }
    return { candidate: record as Candidate, duplicate: false, revised: Boolean(existing) };
  }
  async createStory(story: Story) {
    this.validateStory(story);
    if (story.version !== 1 || story.publicationState === 'PUBLISHED')
      throw Error('Create a version-1 draft; publish atomically through publishStory');
    const contentHash = await hash(story);
    await this.db.batch('story.create', [
      this.db.statement(
        `INSERT INTO canonical_stories(id,team_id,story_type,publication_state,status,headline,summary,importance_score,confidence_score,first_reported_at,meaningful_update_at,latest_evidence_at,hot_read_until,game_id,version,content_hash,record_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        await this.storyValues(story, contentHash),
      ),
      this.db.statement(
        'INSERT INTO story_versions(id,story_id,version,created_at,record_json) VALUES(?,?,1,?,?)',
        [`${story.id}:v1`, story.id, story.meaningfulUpdateAt, await this.payloads.store(story)],
      ),
      ...story.entityKeys.map((key) =>
        this.db.statement('INSERT INTO story_entities(entity_key,story_id) VALUES(?,?)', [
          text(key),
          story.id,
        ]),
      ),
    ]);
  }
  private validateStory(story: Story) {
    [story.id, story.storyType, story.status, story.headline].forEach(text);
    if (story.teamId !== null) teamId(story.teamId);
    if (!['DRAFT', 'REVIEW', 'PUBLISHED', 'WITHDRAWN'].includes(story.publicationState))
      throw Error('Invalid publication state');
    integer(story.version);
    integer(story.meaningfulUpdateAt);
    integer(story.firstReportedAt);
    integer(story.importanceScore);
    integer(story.confidenceScore);
    if (story.entityKeys.length > 32 || new Set(story.entityKeys).size !== story.entityKeys.length)
      throw Error('Entity budget exceeded or duplicates');
  }
  private async storyValues(s: Story, h: string) {
    return [
      s.id,
      s.teamId,
      s.storyType,
      s.publicationState,
      s.status,
      s.headline,
      s.summary,
      s.importanceScore,
      s.confidenceScore,
      s.firstReportedAt,
      s.meaningfulUpdateAt,
      s.latestEvidenceAt,
      s.hotReadUntil,
      s.gameId,
      s.version,
      h,
      await this.payloads.store(s),
    ];
  }
  async associateEvidence(evidence: Evidence) {
    [evidence.id, evidence.storyId, evidence.candidateId, evidence.sourceId].forEach(text);
    integer(evidence.firstSeenAt);
    const [candidate] = await this.db.query<{ revision: number }>(
      'evidence.pin',
      'SELECT revision FROM content_candidates WHERE id=? AND source_id=?',
      [evidence.candidateId, evidence.sourceId],
    );
    if (!candidate) throw Error('Evidence source/candidate is missing');
    const token = crypto.randomUUID();
    await this.db.batch('evidence.associate', [
      this.db.statement(
        'INSERT INTO story_evidence(id,story_id,content_candidate_id,source_id,first_seen_at,record_json,candidate_revision) SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM content_candidate_revisions WHERE candidate_id=? AND revision=?)',
        [
          evidence.id,
          evidence.storyId,
          evidence.candidateId,
          evidence.sourceId,
          evidence.firstSeenAt,
          json(evidence),
          candidate.revision,
          evidence.candidateId,
          candidate.revision,
        ],
      ),
      this.db.guard(token),
      this.db.unguard(token),
    ]);
  }
  async historicalVersion(storyId: string, version: number) {
    integer(version);
    const [row] = await this.db.query<{ record_json: string }>(
      'story.history',
      'SELECT record_json FROM story_versions WHERE story_id=? AND version=?',
      [text(storyId), version],
    );
    return row ? JSON.parse(row.record_json) : null;
  }
  async candidateRevision(candidateId: string, revision: number) {
    integer(revision);
    const [row] = await this.db.query<{ record_json: string }>(
      'candidate.history',
      'SELECT record_json FROM content_candidate_revisions WHERE candidate_id=? AND revision=?',
      [text(candidateId), revision],
    );
    return row ? JSON.parse(row.record_json) : null;
  }
  async storyById(id: string) {
    const [row] = await this.db.query<{ record_json: string }>(
      'story.identity',
      'SELECT record_json FROM canonical_stories WHERE id=?',
      [text(id)],
    );
    return row ? JSON.parse(row.record_json) : null;
  }
  async publishStory(
    story: Story,
    expectedVersion: number,
    details: { decision: RecordData; card: RecordData; evidenceIds: string[]; eventId: string },
  ) {
    this.validateStory(story);
    if (story.publicationState === 'PUBLISHED' && details.decision.allowed !== true)
      throw Error('An explicit positive publication decision is required');
    integer(expectedVersion);
    text(details.eventId);
    if (story.version !== expectedVersion + 1) throw Error('Expected the next story version');
    if (!['PUBLISHED', 'WITHDRAWN', 'REVIEW'].includes(story.publicationState))
      throw Error('Invalid publication transition');
    if (
      !details.evidenceIds.length ||
      details.evidenceIds.length > 32 ||
      new Set(details.evidenceIds).size !== details.evidenceIds.length
    )
      throw Error('A bounded evidence inventory is required');
    details.evidenceIds.forEach(text);
    const token = crypto.randomUUID(),
      contentHash = await hash(story),
      placeholders = details.evidenceIds.map(() => '?').join(',');
    await this.db.batch('story.publish', [
      this.db.statement(
        `UPDATE canonical_stories SET team_id=?,story_type=?,publication_state=?,status=?,headline=?,summary=?,importance_score=?,confidence_score=?,first_reported_at=?,meaningful_update_at=?,latest_evidence_at=?,hot_read_until=?,game_id=?,version=?,content_hash=?,record_json=? WHERE id=? AND version=? AND ?=(SELECT count(*) FROM story_evidence WHERE story_id=? AND id IN (${placeholders}))`,
        [
          ...(await this.storyValues(story, contentHash)).slice(1),
          story.id,
          expectedVersion,
          details.evidenceIds.length,
          story.id,
          ...details.evidenceIds,
        ],
      ),
      this.db.guard(token),
      this.db.statement(
        'INSERT INTO story_versions(id,story_id,version,created_at,record_json) VALUES(?,?,?,?,?)',
        [
          `${story.id}:v${story.version}`,
          story.id,
          story.version,
          story.meaningfulUpdateAt,
          await this.payloads.store({ ...story, evidenceIds: details.evidenceIds }),
        ],
      ),
      this.db.statement(
        'INSERT INTO story_publication_decisions(id,story_id,story_version,record_json) VALUES(?,?,?,?)',
        [`${story.id}:decision:${story.version}`, story.id, story.version, json(details.decision)],
      ),
      this.db.statement(
        'INSERT INTO editorial_cards(id,story_id,story_version,schema_version,descriptor_json) VALUES(?,?,?,1,?)',
        [
          `${story.id}:card:${story.version}`,
          story.id,
          story.version,
          await this.payloads.store(details.card),
        ],
      ),
      this.db.statement(
        "INSERT INTO story_domain_events(id,story_id,story_version,event_type,idempotency_key,occurred_at,record_json) VALUES(?,?,?,'PUBLICATION',?,?,?)",
        [
          details.eventId,
          story.id,
          story.version,
          `${story.id}:${story.version}:publication`,
          story.meaningfulUpdateAt,
          json({ storyId: story.id, version: story.version }),
        ],
      ),
      this.db.statement(
        "INSERT INTO content_outbox(event_id,aggregate_id,aggregate_version,event_type,payload_json,available_at) VALUES(?,?,?,'PUBLICATION',?,?)",
        [
          details.eventId,
          story.id,
          story.version,
          await this.payloads.store({
            story,
            decision: details.decision,
            evidenceIds: details.evidenceIds,
          }),
          story.meaningfulUpdateAt,
        ],
      ),
      this.db.statement('DELETE FROM story_entities WHERE story_id=?', [story.id]),
      ...story.entityKeys.map((key) =>
        this.db.statement('INSERT INTO story_entities(entity_key,story_id) VALUES(?,?)', [
          key,
          story.id,
        ]),
      ),
      this.db.unguard(token),
    ]);
  }
  async storiesForTeam(team: unknown, limit = 20, cursor?: Cursor): Promise<Page<Story>> {
    const t = teamId(team),
      args = pageArgs(limit, cursor);
    const rows = await this.db.query<{ record_json: string; id: string; time: number }>(
      'story.feed',
      `SELECT record_json,id,meaningful_update_at AS time FROM canonical_stories WHERE team_id=? AND publication_state='PUBLISHED' AND (meaningful_update_at<? OR (meaningful_update_at=? AND id<?)) UNION ALL SELECT record_json,id,meaningful_update_at AS time FROM canonical_stories WHERE team_id IS NULL AND publication_state='PUBLISHED' AND (meaningful_update_at<? OR (meaningful_update_at=? AND id<?)) ORDER BY time DESC,id DESC LIMIT ?`,
      [t, ...args, ...args, limit + 1],
    );
    return page<Story>(rows, limit);
  }
  async attribution(storyId: string) {
    const rows = await this.db.query<{ evidence: string; candidate: string; source: string }>(
      'story.attribution',
      `SELECT e.record_json AS evidence,COALESCE(r.record_json,c.record_json) AS candidate,s.record_json AS source FROM story_evidence e JOIN content_candidates c ON c.id=e.content_candidate_id JOIN content_sources s ON s.id=e.source_id LEFT JOIN content_candidate_revisions r ON r.candidate_id=e.content_candidate_id AND r.revision=e.candidate_revision WHERE e.story_id=? ORDER BY e.first_seen_at,e.id`,
      [text(storyId)],
    );
    return rows.map((r) => ({
      evidence: JSON.parse(r.evidence),
      candidate: JSON.parse(r.candidate),
      source: JSON.parse(r.source),
    }));
  }
  async upsertVideo(video: Video) {
    text(video.videoId);
    text(video.sourceId);
    integer(video.publishedAt);
    const assoc = teams(video.teamIds);
    if (!['PUBLIC', 'UNLISTED', 'PRIVATE', 'DELETED', 'UNAVAILABLE'].includes(video.availability))
      throw Error('Invalid video availability');
    const h = await hash(video);
    await this.db.batch('video.upsert', [
      this.db.statement(
        `INSERT INTO film_room_videos(video_id,source_id,published_at,metadata_checked_at,availability,content_hash,record_json) VALUES(?,?,?,?,?,?,?) ON CONFLICT(video_id) DO UPDATE SET source_id=excluded.source_id,published_at=excluded.published_at,metadata_checked_at=excluded.metadata_checked_at,availability=excluded.availability,content_hash=excluded.content_hash,record_json=excluded.record_json`,
        [
          video.videoId,
          video.sourceId,
          video.publishedAt,
          video.metadataCheckedAt,
          video.availability,
          h,
          await this.payloads.store(video),
        ],
      ),
      this.db.statement('DELETE FROM film_room_video_teams WHERE video_id=?', [video.videoId]),
      ...assoc.map((t) =>
        this.db.statement('INSERT INTO film_room_video_teams(team_id,video_id) VALUES(?,?)', [
          t,
          video.videoId,
        ]),
      ),
    ]);
  }
  async videosForTeam(team: unknown, limit = 20, cursor?: Cursor): Promise<Page<Video>> {
    const t = teamId(team),
      args = pageArgs(limit, cursor);
    const rows = await this.db.query<{ record_json: string; id: string; time: number }>(
      'video.feed',
      `SELECT v.record_json,v.video_id AS id,v.published_at AS time FROM film_room_video_teams vt CROSS JOIN film_room_videos v ON v.video_id=vt.video_id WHERE vt.team_id=? AND v.availability='PUBLIC' AND (v.published_at<? OR(v.published_at=? AND v.video_id<?)) ORDER BY v.published_at DESC,v.video_id DESC LIMIT ?`,
      [t, ...args, limit + 1],
    );
    return page<Video>(rows, limit);
  }
  async saveEdition(edition: Edition) {
    teamId(edition.teamId);
    text(edition.id);
    integer(edition.generatedAt);
    if (edition.briefingDate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(edition.briefingDate))
      throw Error('Invalid editorial date');
    if (!['DRAFT', 'PUBLISHED', 'UNAVAILABLE'].includes(edition.status))
      throw Error('Invalid edition state');
    if (edition.status === 'PUBLISHED' && edition.items.length !== 3)
      throw Error('Published Three & Out requires three sourced stories');
    const statements: D1PreparedStatement[] = [];
    if (edition.status === 'PUBLISHED') {
      const ids = edition.items.map((i) => text(i.storyId));
      if (new Set(ids).size !== 3) throw Error('Three distinct stories required');
      const token = crypto.randomUUID();
      statements.push(
        this.db.statement(
          `INSERT INTO transaction_assertions(token,value) SELECT ?,CASE WHEN count(*)=3 THEN 1 ELSE 0 END FROM canonical_stories WHERE id IN (?,?,?) AND publication_state='PUBLISHED' AND (team_id=? OR team_id IS NULL)`,
          [token, ...ids, edition.teamId],
        ),
        this.db.unguard(token),
      );
    }
    statements.push(
      this.db.statement(
        'INSERT INTO three_and_out_snapshots(id,team_id,briefing_date,status,generated_at,source_fingerprint,record_json) VALUES(?,?,?,?,?,?,?)',
        [
          edition.id,
          edition.teamId,
          edition.briefingDate,
          edition.status,
          edition.generatedAt,
          edition.sourceFingerprint,
          await this.payloads.store(edition),
        ],
      ),
    );
    if (edition.status === 'PUBLISHED')
      statements.push(
        this.db.statement(
          "INSERT INTO content_outbox(event_id,aggregate_id,aggregate_version,event_type,payload_json,available_at) VALUES(?,?,1,'EDITION_PUBLISHED',?,?)",
          [
            `edition:${edition.id}`,
            edition.id,
            await this.payloads.store(edition),
            edition.generatedAt,
          ],
        ),
      );
    await this.db.batch('edition.save', statements);
  }
  async editionsForTeam(team: unknown, limit = 20, cursor?: Cursor): Promise<Page<Edition>> {
    const t = teamId(team),
      args = pageArgs(limit, cursor);
    const rows = await this.db.query<{ record_json: string; id: string; time: number }>(
      'edition.feed',
      `SELECT record_json,id,generated_at AS time FROM three_and_out_snapshots WHERE team_id=? AND status='PUBLISHED' AND (generated_at<? OR(generated_at=? AND id<?)) ORDER BY generated_at DESC,id DESC LIMIT ?`,
      [t, ...args, limit + 1],
    );
    return page<Edition>(rows, limit);
  }
}
