import { NextRequest } from 'next/server';
import { POST as automationPost } from '../../../src/app/api/automation/content/global/route';
import { PollingBatches } from '../../../packages/storage/polling-batches';
// Synthetic private benchmark entry only; never referenced by Wrangler configuration.
import { Storage } from '../../../packages/storage/core';
import { D1Objects } from '../../../packages/storage/d1-objects';
import { D1EditorialIngestion } from '../../../packages/storage/editorial-ingestion';
import { DailyBriefings } from '../../../packages/storage/briefings';
import { D1OddsBoard } from '../../../packages/storage/odds-board';
import { computeTrendingProps } from '../../../src/server/historical-stats/trending-props-service';
import { LAB_SCORE_CONFIG } from '../../../packages/parlay/lab-score-config';
import { PrecomputedProps } from '../../../packages/storage/parlay-scores';
import { instrumentDatabase, requestMetrics } from '../../../packages/storage/instrumentation';
import { withApplicationBindings } from '../../../src/server/persistence/bindings';
import { GroundedDeterministicStorySynthesizer } from '../../../src/features/story-engine/synthesis';
import { processSource, processCandidate } from '../../../src/server/story-engine/service';
import { getAllMonitoringSources } from '../../../src/data/sources/monitoring';
import { registeredSourceIntervalSeconds } from '../../../src/features/story-engine/config';
import { PublicEditorial } from '../../../packages/storage/editorial';
import { oddsRefreshSlot } from '../src/odds-schedule';
const RealDate = Date;
let now = RealDate.now();
class Clock extends RealDate {
  constructor(...args: any[]) {
    super(...((args.length ? args : [now]) as [any]));
  }
  static now() {
    return now;
  }
}
(globalThis as any).Date = Clock;
const definition = (x: any) => {
  const rss = x.ingestionMethod === 'RSS_ATOM',
    leagueWide = x.teamId === 'NFL' || x.metadata.multiTeam === true;
  return {
    id: x.id,
    name: x.name,
    sourceType: x.tier === 3 ? 'OTHER' : 'LOCAL_OUTLET',
    teamId: leagueWide ? null : x.teamId,
    leagueWide,
    url: x.canonicalUrl,
    feedUrl: rss ? String(x.metadata.feedUrl) : null,
    fetchStrategy: rss ? 'RSS' : 'STRUCTURED_API',
    pollingTier: x.tier === 1 ? 'A' : x.tier === 2 ? 'B' : 'C',
    priority: x.authorityWeight,
    reliabilityScore: x.authorityWeight / 100,
    checkIntervalSeconds: x.cadenceSeconds ?? 300,
    enabled: x.active && x.availability === 'LIVE' && rss,
    etag: null,
    lastModified: null,
    lastCheckedAt: null,
    lastSuccessfulAt: null,
    nextCheckAt: new Date(),
    failureCount: 0,
    lastError: null,
    metadata: {
      ...x.metadata,
      monitoringTier: x.tier,
      platform: x.platform,
      ingestionMethod: x.ingestionMethod,
      availability: x.availability,
      publishAll: true,
    },
  };
};
export default {
  async fetch(request: Request, env: any) {
    if (
      env.CONTENT_ENV !== 'local' ||
      request.headers.get('authorization') !== 'Bearer synthetic-content-day-only-token'
    )
      return new Response('Forbidden', { status: 403 });
    const b: any = await request.json();
    now = b.now ?? now;
    const m = requestMetrics(),
      db = instrumentDatabase(env.EDITORIAL_DB, m, b.enforceBudget ? 50 : undefined),
      objects = new D1Objects(db),
      s = new Storage(db, objects),
      r = new D1EditorialIngestion(s);
    const started = performance.now();
    try {
      const result = await withApplicationBindings(
        {
          db,
          objects,
          env: {
            APP_DATA_BACKEND: 'd1',
            APP_OBJECT_BACKEND: 'd1',
            OBSERVER_MODE: 'true',
            CONTENT_AUTOMATION_SECRET: 'synthetic-content-day-automation-secret',
          },
        },
        async () => {
          if (b.op === 'registry')
            return getAllMonitoringSources().map((x) => ({
              ...definition(x),
              interval: registeredSourceIntervalSeconds(definition(x) as any),
            }));
          if (b.op === 'registry-http') {
            const response = await automationPost(
              new NextRequest(
                'http://localhost/api/automation/content/global?action=registry&cursor=' + b.cursor,
                {
                  method: 'POST',
                  headers: { authorization: 'Bearer synthetic-content-day-automation-secret' },
                },
              ),
            );
            const body = await response.json();
            if (!response.ok) throw Error('Registry HTTP failed: ' + JSON.stringify(body));
            return body;
          }
          if (b.op === 'sync') {
            const source = getAllMonitoringSources().find((x) => x.id === b.id);
            if (!source) throw Error('Missing source');
            await r.syncSource(definition(source) as any);
            return true;
          }
          if (b.op === 'seed-retention') {
            const c = {
              id: b.candidate,
              sourceId: b.id,
              externalId: b.candidate,
              url: `https://example.invalid/${b.candidate}`,
              title: 'Processed synthetic source evidence',
              normalizedTitle: 'processed synthetic source evidence',
              author: 'Original source',
              publishedAt: new Date().toISOString(),
              discoveredAt: new Date().toISOString(),
              text: 'Original required evidence',
              excerpt: 'Original evidence',
              entities: [],
              candidateTeams: [],
              fingerprint: b.candidate,
              status: 'REJECTED',
              storyType: 'ANALYSIS',
            };
            await r.saveCandidate(c as any);
            await r.enqueueJob('CANDIDATE_PROCESS', `candidate:${b.candidate}`, {
              candidateId: b.candidate,
            });
            const job = await r.claimJob('synthetic-seed');
            if (!job) throw Error('Missing seed job');
            await r.finishJob(job.id, job.locked_by);
            return true;
          }
          if (b.op === 'batch') {
            const batches = new PollingBatches(s);
            const lease = b.token ? { token: b.token } : await batches.claim();
            if (!lease) return { done: true, checks: 0, idle: true };
            const result = await batches.step(lease.token, {
              async fetch(source) {
                const item = b.feeds?.[source.id];
                return {
                  items: item ? [item] : [],
                  notModified: !item,
                  etag: '"synthetic-feed-v1"',
                  lastModified: null,
                };
              },
            });
            return { ...result, token: result.done ? null : lease.token };
          }
          if (b.op === 'poll') {
            const source = await r.sourceById(b.id);
            if (!source) throw Error('Missing source');
            await r.enqueueJob(
              'SOURCE_FETCH',
              `fetch:${source.id}:${Math.floor(now / (registeredSourceIntervalSeconds(source) * 1000))}`,
              { sourceId: source.id },
            );
            const job = await r.claimJob(
              'synthetic-worker',
              source.teamId ?? undefined,
              'standard',
            );
            if (!job) throw Error('Job not claimed');
            const payload = typeof job.payload === 'string' ? JSON.parse(job.payload) : job.payload;
            let result: any;
            if (job.job_type === 'SOURCE_FETCH') {
              const fetched = await r.sourceById(payload.sourceId);
              result = await processSource(fetched!, {
                async fetch() {
                  return {
                    items: b.item ? [b.item] : [],
                    notModified: !b.item && !b.duplicate,
                    etag: '"synthetic-feed-v1"',
                    lastModified: null,
                  };
                },
              });
            } else
              result = await processCandidate(
                payload.candidateId,
                new GroundedDeterministicStorySynthesizer(),
              );
            await r.finishJob(job.id, job.locked_by);
            return result;
          }
          if (b.op === 'drain') {
            if (b.enforceBudget) {
              const response = await automationPost(
                new NextRequest(
                  'http://localhost/api/automation/content/global?action=candidate&group=standard' +
                    (b.team ? '&team=' + b.team : ''),
                  {
                    method: 'POST',
                    headers: { authorization: 'Bearer synthetic-content-day-automation-secret' },
                  },
                ),
              );
              const body: any = await response.json();
              if (!response.ok) throw Error('Bounded automation failed: ' + JSON.stringify(body));
              return body.job?.result ?? null;
            }
            const job = await r.claimJob('synthetic-worker', b.team, 'standard');
            if (!job) return null;
            const payload = typeof job.payload === 'string' ? JSON.parse(job.payload) : job.payload;
            const result =
              job.job_type === 'CANDIDATE_PROCESS'
                ? await processCandidate(
                    payload.candidateId,
                    new GroundedDeterministicStorySynthesizer(),
                  )
                : { skipped: true };
            if ((result as any).skipped) throw Error('Unexpected unprocessed source job');
            await r.finishJob(job.id, job.locked_by);
            return result;
          }
          if (b.op === 'correct') {
            const story = await r.storyById(b.id);
            if (!story) throw Error('Missing story');
            const { id, teamId, version, publicationState, ...synth } = story;
            await r.promoteExistingStory(story, { ...synth, headline: b.headline } as any, {
              action: 'AUTO_PUBLISH',
              reason: 'Verified synthetic correction',
              confidence: 95,
              breaking: false,
            });
            return story.id;
          }
          if (b.op === 'brief') {
            const rows = await new PublicEditorial(s).page({ teamId: b.team, limit: 3 } as any);
            return rows;
          }
          if (b.op === 'brief-publish') {
            await new DailyBriefings(s).publish(b.row);
            return true;
          }
          if (b.op === 'odds') {
            if (!oddsRefreshSlot(new Date(now))) throw Error('Not a refresh slot');
            const board = new D1OddsBoard(s);
            return board.publish(
              { ...b.input, kickoffAt: new Date(b.input.kickoffAt) },
              b.rows,
              now,
              b.id,
            );
          }
          if (b.op === 'scores') {
            const p = new PrecomputedProps(s),
              rows = await computeTrendingProps(b.id, {}, 2026, undefined, 'all');
            return p.publish(
              b.id,
              LAB_SCORE_CONFIG.version,
              {},
              2026,
              undefined,
              await p.sources(b.id),
              rows,
            );
          }
          if (b.op === 'inspect') {
            const capacity = await db
              .prepare('SELECT used_bytes FROM app_payload_capacity WHERE id=1')
              .all();
            return {
              physicalBytes: capacity.meta.size_after,
              encoded: capacity.results[0]?.used_bytes ?? 0,
              stories: await s.rows('SELECT id,team_id,version FROM app_editorial_stories'),
              sourceCheckpoints: b.enforceBudget
                ? await s.rows(
                    'SELECT id,request_count,next_check_at,last_checked_at,failure_count,etag FROM app_editorial_sources WHERE enabled=1',
                  )
                : undefined,
              pendingInbox: b.enforceBudget
                ? await s.rows('SELECT source_id FROM app_storage_poll_retry')
                : undefined,
              jobs: await s.rows(
                'SELECT status,count(*) n FROM app_editorial_jobs GROUP BY status',
              ),
            };
          }
          throw Error('Unknown operation');
        },
      );
      return Response.json({
        result,
        metrics: m,
        wallMs: performance.now() - started,
        cpuMs: null,
      });
    } catch (e) {
      return Response.json({ error: String(e), metrics: m }, { status: 500 });
    }
  },
};
