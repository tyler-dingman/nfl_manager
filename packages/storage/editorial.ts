const canonical = (value: unknown): string =>
  JSON.stringify(value, (_key, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  );
import { Storage } from './core';
import type { StoryView } from '../../src/features/story-engine/public-story';
import { isStoryPublishable } from '../../src/features/story-engine/public-story';
import type { PublicStoryPageOptions, WireEntry } from '../../src/server/story-engine/projections';
import { selectWireEvents } from '../../src/features/story-engine/surface-selectors';
export class PublicEditorial {
  constructor(readonly s: Storage) {}
  async prepare(
    story: StoryView,
    state: string,
    evidenceAt = Date.parse(story.lastMeaningfulUpdateAt),
    guardCollector?: { sql: string; values: unknown[] }[],
  ) {
    const visible = isStoryPublishable({
      publicationState: state as any,
      confidenceScore: story.confidenceScore,
      status: story.status,
      sourceCount: story.sources.length,
    });
    const { whatHappened, whyItMatters, whatsNext, sources, primarySource, ...metadata } = story;
    const body = { whatHappened, whyItMatters, whatsNext, sources, primarySource };
    const hash =
      this.s.objects.compactTrees && new TextEncoder().encode(JSON.stringify(body)).length > 4096
        ? await this.s.put({
            schema: 2,
            kind: 'PUBLIC_STORY',
            story: metadata,
            state,
            bodyHash: await this.s.put({ schema: 1, kind: 'PUBLIC_STORY_BODY', body }),
          })
        : await this.s.put({ schema: 1, kind: 'PUBLIC_STORY', story, state });
    const [prior] = await this.s.rows<{ version: number; object_hash: string }>(
      'SELECT version,object_hash FROM app_public_stories WHERE id=?',
      [story.id],
    );
    if (prior?.version > story.version) throw Error('Editorial version conflict');
    if (prior?.version === story.version && prior.object_hash !== hash) {
      const previous = await this.expand(await this.s.get<any>(prior.object_hash));
      if (canonical(previous.story) !== canonical(story)) throw Error('Editorial version conflict');
    }
    if (prior?.object_hash === hash) return [];
    const idBytes = crypto.getRandomValues(new Uint32Array(2)),
      rowid = -(Number(idBytes[0] & 0xfffff) * 4294967296 + idBytes[1] + 1),
      primary = story.primarySource ?? story.sources[0];
    const nonce = crypto.randomUUID();
    if (guardCollector)
      guardCollector.push(
        prior
          ? {
              sql: 'EXISTS(SELECT 1 FROM app_public_stories WHERE id=? AND version=? AND object_hash=?)',
              values: [story.id, prior.version, prior.object_hash],
            }
          : { sql: 'NOT EXISTS(SELECT 1 FROM app_public_stories WHERE id=?)', values: [story.id] },
      );
    return [
      this.s.statement(
        'INSERT INTO app_public_stories(id,search_rowid,team_id,story_type,importance,first_at,updated_at,evidence_at,hot_until,version,visible,object_hash) VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET team_id=excluded.team_id,story_type=excluded.story_type,importance=excluded.importance,first_at=excluded.first_at,updated_at=excluded.updated_at,evidence_at=excluded.evidence_at,hot_until=excluded.hot_until,version=excluded.version,visible=excluded.visible,object_hash=excluded.object_hash WHERE version=? AND object_hash=?',
        [
          story.id,
          rowid,
          story.teamId,
          story.storyType,
          story.importanceScore,
          Date.parse(story.firstReportedAt),
          Date.parse(story.lastMeaningfulUpdateAt),
          evidenceAt,
          story.hotReadUntil ? Date.parse(story.hotReadUntil) : null,
          story.version,
          visible ? 1 : 0,
          hash,
          prior?.version ?? story.version,
          prior?.object_hash ?? null,
        ],
      ),
      ...(guardCollector ? [] : [this.s.guard(nonce), this.s.unguard(nonce)]),
      this.s.statement(
        'INSERT INTO app_public_story_versions(id,version,object_hash) VALUES(?,?,?)',
        [story.id, story.version, hash],
      ),
      this.s.statement(
        'DELETE FROM app_search WHERE rowid=(SELECT search_rowid FROM app_public_stories WHERE id=?)',
        [story.id],
      ),
      this.s.statement(
        'INSERT INTO app_search(rowid,id,team_id,title,content,source_id,source_url) SELECT search_rowid,id,team_id,?,?,?,? FROM app_public_stories WHERE id=? AND visible=1',
        [
          story.headline,
          [story.shortSummary, story.whatHappened, ...story.sources.map((s) => s.name)].join('\n'),
          primary?.id ?? '',
          primary?.url ?? '',
          story.id,
        ],
      ),
    ];
  }
  async publish(
    story: StoryView,
    state: string,
    evidenceAt = Date.parse(story.lastMeaningfulUpdateAt),
  ) {
    const writes = await this.prepare(story, state, evidenceAt);
    if (writes.length) await this.s.batch(writes);
  }
  private async expand(envelope: any) {
    if (envelope.schema === 2 && envelope.kind === 'PUBLIC_STORY') {
      const payload = await this.s.get<any>(envelope.bodyHash);
      if (payload.schema !== 1 || payload.kind !== 'PUBLIC_STORY_BODY' || !payload.body)
        throw Error('Public story body identity mismatch');
      const fields = ['whatHappened', 'whyItMatters', 'whatsNext', 'sources', 'primarySource'];
      if (
        Object.keys(payload.body).length !== fields.length ||
        fields.some((key) => !Object.hasOwn(payload.body, key))
      )
        throw Error('Invalid public story body');
      return { ...envelope, schema: 1, story: { ...envelope.story, ...payload.body } };
    }
    return envelope;
  }
  async version(id: string, version: number) {
    if (!Number.isSafeInteger(version) || version < 1) throw Error('Invalid story version');
    const [row] = await this.s.rows<{ id: string; object_hash: string }>(
      'SELECT v.id,v.object_hash FROM app_public_story_versions v JOIN app_public_stories p ON p.id=v.id WHERE v.id=? AND v.version=? AND p.visible=1',
      [id, version],
    );
    if (!row) return null;
    const envelope = await this.expand(await this.s.get<any>(row.object_hash));
    if (
      envelope.kind !== 'PUBLIC_STORY' ||
      envelope.schema !== 1 ||
      envelope.story.id !== id ||
      envelope.story.version !== version
    )
      throw Error('Public story identity mismatch');
    return isStoryPublishable({
      publicationState: envelope.state,
      confidenceScore: envelope.story.confidenceScore,
      status: envelope.story.status,
      sourceCount: envelope.story.sources.length,
    })
      ? (envelope.story as StoryView)
      : null;
  }
  async load(rows: { object_hash: string; id: string }[]) {
    const result: StoryView[] = [];
    for (let i = 0; i < rows.length; i += 32) {
      await this.s.objects.prefetch?.(
        rows.slice(i, i + 32).map((r) => `application/v1/${r.object_hash}`),
      );
      const envelopes = await Promise.all(
        rows.slice(i, i + 32).map((r) => this.s.get<any>(r.object_hash)),
      );
      await this.s.objects.prefetch?.(
        envelopes
          .filter((p) => p.schema === 2 && p.kind === 'PUBLIC_STORY')
          .map((p) => `application/v1/${p.bodyHash}`),
      );
      for (const [index, stored] of envelopes.entries()) {
        const envelope = await this.expand(stored);
        if (
          envelope.schema !== 1 ||
          envelope.kind !== 'PUBLIC_STORY' ||
          envelope.story.id !== rows[i + index].id
        )
          throw Error('Public story identity mismatch');
        result.push(envelope.story);
      }
    }
    return result;
  }
  async get(id: string) {
    const rows = await this.s.rows<any>(
      'SELECT id,object_hash FROM app_public_stories WHERE id=? AND visible=1',
      [id],
    );
    return (await this.load(rows))[0] ?? null;
  }
  async list(team: string, limit = 30) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 200) throw Error('Story page limit');
    return this.load(
      await this.s.rows<any>(
        'SELECT id,object_hash FROM app_public_stories WHERE team_id=? AND visible=1 ORDER BY importance DESC,updated_at DESC,id DESC LIMIT ?',
        [team, limit],
      ),
    );
  }
  async page(team: string, options: PublicStoryPageOptions) {
    const limit = options.pageSize ?? 30;
    if (!Number.isInteger(limit) || limit < 1 || limit > 200) throw Error('Story page limit');
    const query = options.query?.trim() ?? '',
      filter = options.filter ?? 'ALL',
      days =
        options.timeRange === 'TODAY'
          ? 1
          : options.timeRange === 'WEEK'
            ? 7
            : options.timeRange === 'MONTH'
              ? 30
              : 0;
    const patterns =
      filter === 'ROSTER'
        ? ['%ROSTER%', '%TRANSACTION%', '%TRADE%', '%CONTRACT%', '%SIGNING%']
        : filter === 'INJURIES'
          ? ['%INJUR%']
          : filter === 'DRAFT'
            ? ['%DRAFT%']
            : filter === 'GAMES'
              ? ['%GAME%', '%PREVIEW%', '%RESULT%']
              : [];
    let where = 'team_id=? AND visible=1',
      values: unknown[] = [team];
    if (days) {
      where += ' AND updated_at>=?';
      values.push(Date.now() - days * 86400000);
    }
    if (filter === 'HOT') {
      where += ' AND hot_until>?';
      values.push(Date.now());
    }
    if (patterns.length) {
      where += ' AND (' + patterns.map(() => 'story_type LIKE ?').join(' OR ') + ')';
      values.push(...patterns);
    }
    if (query) {
      where +=
        ' AND search_rowid IN(SELECT rowid FROM app_search WHERE title LIKE ? OR content LIKE ?)';
      values.push('%' + query + '%', '%' + query + '%');
    }
    const [count] = await this.s.rows<{ n: number }>(
        'SELECT count(*) AS n FROM app_public_stories WHERE ' + where,
        values,
      ),
      totalPages = Math.ceil(count.n / limit),
      page = totalPages ? Math.min(Math.max(1, Math.floor(options.page)), totalPages) : 1;
    const rows = await this.s.rows<any>(
      'SELECT id,object_hash FROM app_public_stories WHERE ' +
        where +
        ' ORDER BY ' +
        (options.sort === 'NEWEST' ? 'first_at' : 'updated_at') +
        ' DESC,evidence_at DESC,id DESC LIMIT ? OFFSET ?',
      [...values, limit, (page - 1) * limit],
    );
    return {
      stories: await this.load(rows),
      page,
      pageSize: limit,
      totalItems: count.n,
      totalPages,
    };
  }
  async wire(team: string, limit = 20) {
    const stories = await this.list(team, 50),
      byId = new Map(stories.map((s) => [s.id, s]));
    if (!stories.length) return [];
    const rows = await this.s.rows<any>(
      'SELECT * FROM app_public_wire WHERE team_id=? AND story_id IN(SELECT value FROM json_each(?)) ORDER BY occurred_at DESC LIMIT ?',
      [team, JSON.stringify(stories.map((s) => s.id)), limit * 2],
    );
    await this.s.objects.prefetch?.(rows.map((r) => `application/v1/${r.object_hash}`));
    const events = await Promise.all(
      rows.map(async (r) => {
        const event = await this.s.get<any>(r.object_hash);
        if (
          event.id !== r.id ||
          event.storyId !== r.story_id ||
          event.storyVersion !== r.story_version ||
          event.eventType !== r.event_type
        )
          throw Error('Wire event identity mismatch');
        return event;
      }),
    );
    const selected = selectWireEvents(events).slice(0, limit);
    return selected.flatMap((event) => {
      const r = rows.find((r) => r.id === event.id),
        story = byId.get(r.story_id);
      if (!story) return [];
      return [
        {
          id: event.id,
          storyId: story.id,
          storyVersion: r.story_version,
          teamId: team,
          type:
            r.event_type === 'StoryCreated'
              ? 'NEW'
              : r.event_type === 'StoryResolved'
                ? 'RESOLVED'
                : r.event_type === 'StoryBecameBreaking'
                  ? 'BREAKING'
                  : event.payload?.change === 'OFFICIAL_CONFIRMATION'
                    ? 'OFFICIAL'
                    : 'UPDATE',
          headline: story.headline,
          summary: story.shortSummary,
          occurredAt: event.occurredAt,
          sources: story.sources,
          primarySource: story.primarySource,
        } as WireEntry,
      ];
    });
  }
}
