import { applicationDatabaseRouter } from '../../src/server/persistence/bindings';
import { canonicalizeUrl } from '../../src/features/story-engine/normalization';
import { Storage } from './core';
import { D1EditorialIngestion } from './editorial-ingestion';
import {
  nextCheckAfterFailure,
  nextCheckAfterSuccess,
  registeredSourceIntervalSeconds,
} from '../../src/features/story-engine/config';
import {
  RssSourceFetcher,
  YouTubeSourceFetcher,
  type SourceFetcher,
} from '../../src/server/story-engine/fetcher';
import { processSource } from '../../src/server/story-engine/service';

const canonicalUrl = (value: string) => {
  try {
    return canonicalizeUrl(value);
  } catch {
    return value;
  }
};
// Eight independent fetches maximum, then at most one new item per continuation.
// Ownership is fenced in SQL, not inferred from an earlier lease read.
export class PollingBatches {
  constructor(readonly s: Storage) {}
  async claim(team?: string, group?: 'standard' | 'video') {
    const now = Date.now(),
      token = crypto.randomUUID();
    const [ready] = await this.s.rows<any>(
      `SELECT 1 ready WHERE EXISTS(SELECT 1 FROM app_editorial_sources
      WHERE enabled=1 AND next_check_at<=? AND (? IS NULL OR team_id=? OR league_wide=1)
      AND (? IS NULL OR CASE WHEN ?='video' THEN source_type='YOUTUBE' OR platform='YOUTUBE' ELSE source_type<>'YOUTUBE' AND coalesce(platform,'')<>'YOUTUBE' END))
      AND NOT EXISTS(SELECT 1 FROM app_storage_poll_batch WHERE id=1 AND expires_at>?)`,
      [now, team ?? null, team ?? null, group ?? null, group ?? null, now],
    );
    if (!ready) return null; // Idle ticks must not pay for write-fence mutations.
    const [lease] = await this.s.rows<any>(
      `INSERT INTO app_storage_poll_batch(id,token,expires_at,payload)
      SELECT 1,?,?,json_object('ids',json_group_array(id)) FROM (
        SELECT id FROM app_editorial_sources WHERE enabled=1 AND next_check_at<=?
        AND (? IS NULL OR team_id=? OR league_wide=1)
        AND (? IS NULL OR CASE WHEN ?='video' THEN source_type='YOUTUBE' OR platform='YOUTUBE' ELSE source_type<>'YOUTUBE' AND coalesce(platform,'')<>'YOUTUBE' END)
        ORDER BY priority DESC,next_check_at,id LIMIT 8)
      HAVING count(*)>0
      ON CONFLICT(id) DO UPDATE SET token=excluded.token,expires_at=excluded.expires_at,
        payload=CASE WHEN json_type(app_storage_poll_batch.payload,'$.results') IS NOT NULL THEN app_storage_poll_batch.payload ELSE excluded.payload END
      WHERE app_storage_poll_batch.expires_at<=? RETURNING *`,
      [token, now + 120000, now, team ?? null, team ?? null, group ?? null, group ?? null, now],
    );
    return lease ? { token: lease.token, payload: JSON.parse(lease.payload) } : null;
  }
  async read(token: string) {
    const [row] = await this.s.rows<any>(
      'SELECT payload FROM app_storage_poll_batch WHERE id=1 AND token=? AND expires_at>?',
      [token, Date.now()],
    );
    if (!row) throw Error('Polling lease expired or replaced');
    const payload = JSON.parse(row.payload);
    if (payload.results) {
      const inbox = await this.s.rows<any>(
        'SELECT source_id,payload FROM app_storage_poll_retry WHERE source_id IN(SELECT value FROM json_each(?))',
        [JSON.stringify(payload.ids)],
      );
      for (const result of payload.results)
        if (result.inbox) {
          const entry = inbox.find((r) => r.source_id === result.id);
          if (!entry) throw Error('Missing durable source inbox');
          result.items = JSON.parse(entry.payload).items;
        }
    }
    return payload;
  }
  async persist(token: string, payload: any) {
    const now = Date.now(),
      statements = [];
    const results = payload.results?.map((r: any) => {
      if (r.items.length || r.inbox) {
        const text = JSON.stringify(r);
        if (new TextEncoder().encode(text).length > 1_900_000)
          throw Error('Source inbox exceeds D1 row limit; checkpoint not advanced');
        statements.push(
          this.s.statement(
            `INSERT INTO app_storage_poll_retry(source_id,payload)
          SELECT ?,? WHERE EXISTS(SELECT 1 FROM app_storage_poll_batch WHERE id=1 AND token=? AND expires_at>?)
          ON CONFLICT(source_id) DO UPDATE SET payload=excluded.payload`,
            [r.id, text, token, now],
          ),
        );
        return { ...r, items: [], inbox: true };
      }
      return r;
    });
    statements.push(
      this.s.statement(
        'UPDATE app_storage_poll_batch SET payload=?,expires_at=? WHERE id=1 AND token=? AND expires_at>?',
        [JSON.stringify({ ...payload, results }), now + 120000, token, now],
      ),
    );
    const committed = await this.s.batch(statements);
    if (committed.at(-1)!.meta.changes !== 1) throw Error('Polling lease expired or replaced');
  }
  async finish(token: string, results: any[]) {
    const encoded = JSON.stringify(results.map((r) => ({ ...r, items: undefined }))),
      now = Date.now();
    // Checkpoint and lease release share a single atomic, maintenance-fenced batch.
    // An expired owner cannot update even one checkpoint.
    const failed = results
      .filter((r) => r.error && r.items.length)
      .map((r) =>
        this.s.statement(
          `INSERT INTO app_storage_poll_retry(source_id,payload)
      SELECT ?,? WHERE EXISTS(SELECT 1 FROM app_storage_poll_batch WHERE id=1 AND token=? AND expires_at>?)
      ON CONFLICT(source_id) DO UPDATE SET payload=excluded.payload`,
          [r.id, JSON.stringify(r), token, now],
        ),
      );
    const updated = await this.s.batch([
      ...failed,
      this.s.statement(
        `DELETE FROM app_storage_poll_retry WHERE source_id IN(
        SELECT json_extract(value,'$.id') FROM json_each(?) WHERE json_extract(value,'$.error') IS NULL)
        AND EXISTS(SELECT 1 FROM app_storage_poll_batch WHERE id=1 AND token=? AND expires_at>?)`,
        [encoded, token, now],
      ),
      this.s.statement(
        `UPDATE app_editorial_sources AS s SET
        etag=CASE WHEN json_extract(j.value,'$.error') IS NULL THEN json_extract(j.value,'$.etag') ELSE s.etag END,
        last_modified=CASE WHEN json_extract(j.value,'$.error') IS NULL THEN json_extract(j.value,'$.modified') ELSE s.last_modified END,
        next_check_at=json_extract(j.value,'$.next'),last_checked_at=json_extract(j.value,'$.checked'),
        last_successful_at=CASE WHEN json_extract(j.value,'$.error') IS NULL THEN json_extract(j.value,'$.checked') ELSE s.last_successful_at END,
        last_item_at=CASE WHEN json_extract(j.value,'$.error') IS NULL THEN coalesce(json_extract(j.value,'$.last'),s.last_item_at) ELSE s.last_item_at END,
        failure_count=CASE WHEN json_extract(j.value,'$.error') IS NULL THEN 0 ELSE s.failure_count+1 END,
        consecutive_failures=CASE WHEN json_extract(j.value,'$.error') IS NULL THEN 0 ELSE s.consecutive_failures+1 END,
        average_latency_ms=(coalesce(s.average_latency_ms,0)*s.request_count+json_extract(j.value,'$.latency'))/(s.request_count+1),
        request_count=s.request_count+1,last_error=json_extract(j.value,'$.error'),updated_at=?
        FROM json_each(?) j WHERE s.id=json_extract(j.value,'$.id')
        AND EXISTS(SELECT 1 FROM app_storage_poll_batch WHERE id=1 AND token=? AND expires_at>?)`,
        [now, encoded, token, now],
      ),
      this.s.statement(
        'DELETE FROM app_storage_poll_batch WHERE id=1 AND token=? AND expires_at>?',
        [token, now],
      ),
    ]);
    if (updated.at(-1)!.meta.changes !== 1) throw Error('Polling lease expired or replaced');
  }
  async step(token: string, fetcher?: SourceFetcher) {
    const payload = await this.read(token),
      repo = new D1EditorialIngestion(this.s);
    if (!payload.results) {
      // Prefetch immutable definitions together rather than N+1 object reads.
      const rows = await this.s.rows<any>(
        'SELECT object_hash FROM app_editorial_sources WHERE id IN (SELECT value FROM json_each(?))',
        [JSON.stringify(payload.ids)],
      );
      await this.s.objects.prefetch?.(rows.map((r) => 'application/v1/' + r.object_hash));
      const retries = await this.s.rows<any>(
        'SELECT source_id,payload FROM app_storage_poll_retry WHERE source_id IN(SELECT value FROM json_each(?))',
        [JSON.stringify(payload.ids)],
      );
      const results: any[] = [];
      for (const id of payload.ids) {
        const source = await repo.sourceById(id);
        if (!source) throw Error('Polling source disappeared');
        const retry = retries.find((r) => r.source_id === id);
        if (retry) {
          const prior = JSON.parse(retry.payload);
          results.push({
            ...prior,
            error: undefined,
            checked: Date.now(),
            next: nextCheckAfterSuccess(registeredSourceIntervalSeconds(source)).getTime(),
          });
          continue;
        }
        const started = Date.now();
        try {
          const f =
            fetcher ??
            (source.metadata.platform === 'YOUTUBE'
              ? new YouTubeSourceFetcher()
              : new RssSourceFetcher());
          const result = await f.fetch(source);
          results.push({
            id,
            checked: Date.now(),
            next: nextCheckAfterSuccess(registeredSourceIntervalSeconds(source)).getTime(),
            etag: result.etag,
            modified: result.lastModified,
            latency: Date.now() - started,
            last: result.items.length
              ? Math.max(...result.items.map((x) => new Date(x.publishedAt).getTime()))
              : null,
            items: result.items,
          });
        } catch (error) {
          results.push({
            id,
            checked: Date.now(),
            next: nextCheckAfterFailure(
              registeredSourceIntervalSeconds(source),
              source.failureCount + 1,
            ).getTime(),
            latency: Date.now() - started,
            error: String(error).slice(0, 1000),
            items: [],
          });
        }
      }
      const urls = results.flatMap((r) => r.items.map((x: any) => canonicalUrl(x.url)));
      if (urls.length) {
        // A retried candidate may have been saved immediately before termination.
        // Repair its durable processing job before dropping duplicate feed items.
        await this.s
          .statement(
            `INSERT INTO app_editorial_jobs(id,job_type,idempotency_key,payload,available_at,created_at,updated_at)
          SELECT 'candidate:'||id,'CANDIDATE_PROCESS','candidate:'||id,json_object('candidateId',id),?,?,?
          FROM app_editorial_candidates WHERE status='NEW' AND canonical_url IN(SELECT value FROM json_each(?))
          ON CONFLICT(idempotency_key) DO NOTHING`,
            [Date.now(), Date.now(), Date.now(), JSON.stringify(urls)],
          )
          .run();
        const known = await this.s.rows<any>(
          `SELECT canonical_url FROM app_editorial_candidates WHERE canonical_url IN(SELECT value FROM json_each(?))
          UNION SELECT canonical_url FROM app_storage_candidate_receipts WHERE canonical_url IN(SELECT value FROM json_each(?))
          ${applicationDatabaseRouter() ? 'UNION SELECT canonical_url FROM app_editorial_handoffs WHERE canonical_url IN(SELECT value FROM json_each(?))' : ''}`,
          [
            JSON.stringify(urls),
            JSON.stringify(urls),
            ...(applicationDatabaseRouter() ? [JSON.stringify(urls)] : []),
          ],
        );
        const seen = new Set(known.map((r) => r.canonical_url));
        for (const r of results)
          r.items = r.items.filter((x: any) => !seen.has(canonicalUrl(x.url)));
      }
      if (!results.some((r) => r.items.length)) {
        await this.finish(token, results);
        return {
          done: true,
          checks: results.length,
          failures: results.filter((r) => r.error).length,
        };
      }
      await this.persist(token, { ...payload, results });
      return { done: false, checks: results.length };
    }
    const entry = payload.results.find((r: any) => r.items.length && !r.error);
    if (entry) {
      const source = await repo.sourceById(entry.id);
      if (!source) throw Error('Polling source disappeared');
      try {
        await processSource(
          source,
          {
            async fetch() {
              return {
                items: [entry.items[0]],
                etag: entry.etag,
                lastModified: entry.modified,
                notModified: false,
              };
            },
          },
          { deferCheckpoint: true },
        );
        // Re-run after an ambiguous failure; receipts/candidate IDs prevent duplication.
        await this.s
          .statement(
            `INSERT INTO app_editorial_jobs(id,job_type,idempotency_key,payload,available_at,created_at,updated_at)
        SELECT 'candidate:'||id,'CANDIDATE_PROCESS','candidate:'||id,json_object('candidateId',id),?,?,?
        FROM app_editorial_candidates WHERE source_id=? AND status='NEW' AND (canonical_url=? OR external_id=?)
        ON CONFLICT(idempotency_key) DO NOTHING`,
            [
              Date.now(),
              Date.now(),
              Date.now(),
              source.id,
              canonicalUrl(entry.items[0].url),
              entry.items[0].externalId,
            ],
          )
          .run();
        entry.items.shift();
      } catch (error) {
        // Preserve the remaining original evidence for this source while the
        // other sources in the batch continue. Retry after normal source backoff.
        entry.error = String(error).slice(0, 1000);
        entry.next = nextCheckAfterFailure(
          registeredSourceIntervalSeconds(source),
          source.failureCount + 1,
        ).getTime();
      }
    }
    if (!payload.results.some((r: any) => r.items.length && !r.error)) {
      await this.finish(token, payload.results);
      return { done: true, checks: 0 };
    }
    await this.persist(token, payload);
    return { done: false, checks: 0 };
  }
}
