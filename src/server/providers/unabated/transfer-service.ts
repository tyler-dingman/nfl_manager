import { sportsbookConfig, type Sportsbook } from '../../../../packages/parlay/sportsbook-transfer';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { authDb } from '../../auth/database';
import { UnabatedClient, UnabatedError } from './client';
import {
  eligibleTransfer,
  UnresolvedTransferRegion,
  generationPrompt,
  validateTestCandidate,
  type TransferLeg,
} from './test-transfer-validation';
import { transferFailure, type TransferState } from '../../../../packages/parlay/fanduel-transfer';
export class TransferError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}
export function transferEnabled(userId: string, env = process.env, book: Sportsbook = 'fanduel') {
  return (
    ['development', 'test'].includes(env.NODE_ENV ?? '') &&
    env[sportsbookConfig[book].flag] === 'true' &&
    env.ENABLE_UNABATED_INGESTION === 'false' &&
    env.ODDS_PROVIDER === 'sportsgameodds' &&
    !!env.UNABATED_API_KEY &&
    !!env.UNABATED_PARTNER_CODE &&
    (env.FANDUEL_TEST_USER_IDS ?? '')
      .split(',')
      .map((s) => s.trim())
      .includes(userId)
  );
}
export const transferLimits = () => ({
  user: limit('UNABATED_MAX_GENERATIONS_PER_USER_DAY', 50),
  global: limit('UNABATED_MAX_GENERATIONS_GLOBAL_DAY', 50),
  concurrent: limit('UNABATED_MAX_CONCURRENT_GENERATIONS', 3),
});
function limit(key: string, fallback: number) {
  const n = Number(process.env[key] ?? fallback);
  return Number.isSafeInteger(n) && n >= 0 ? Math.min(n, fallback) : 0;
}
export type Job = {
  id: string;
  sportsbook: Sportsbook;
  actor: string;
  fingerprint: string;
  region: string;
  legs: TransferLeg[];
  status: TransferState['status'];
  request_id: string | null;
  url: string | null;
  error: string | null;
  expires_at: Date;
  next_poll_at: Date;
  poll_count: number;
  api_calls: number;
};
export const fingerprint = (ids: string[], region: string, book: Sportsbook = 'fanduel') =>
  createHash('sha256')
    .update(JSON.stringify([book, region, [...ids].sort()]))
    .digest('hex');
export function quotaReason(
  counts: { user: number; global: number; active: number },
  limits: ReturnType<typeof transferLimits>,
) {
  return counts.user >= limits.user || counts.global >= limits.global
    ? 'The Sportsbook test generation budget has been reached. Try another day.'
    : counts.active >= limits.concurrent
      ? 'Sportsbook preparation is busy. Please try later.'
      : null;
}
export function createTransferService(db = authDb(), client = new UnabatedClient()) {
  const actor = (user: string) =>
    createHmac('sha256', process.env.AUTH_JWT_SECRET!)
      .update('fanduel:' + user)
      .digest('hex');
  async function resolve(ids: string[], book: Sportsbook = 'fanduel'): Promise<TransferLeg[]> {
    const rows = await db<
      TransferLeg[]
    >`SELECT m.id,m.event_id AS "eventId",m.player_id AS "playerId",pm.provider_name AS "playerName",m.team_id AS "teamId",m.market_type AS "marketType",m.period,m.side,m.line::float8,p.odds,${sportsbookConfig[book].stored}::text AS sportsbook,p.available,p.updated_at AS "oddsUpdatedAt",e.kickoff_at AS "kickoffAt",e.home_team_id AS "homeTeamId",e.away_team_id AS "awayTeamId"
  FROM bet_markets m JOIN sportsbook_events e ON e.id=m.event_id JOIN sportsbook_prices p ON p.market_id=m.id AND p.sportsbook=${sportsbookConfig[book].stored} AND p.available
  JOIN provider_player_mappings pm ON pm.provider=e.provider AND pm.provider_player_id=m.entity_id AND pm.player_id=m.player_id
  WHERE m.id IN ${db(ids)} AND e.provider='SPORTSGAMEODDS' AND NOT e.markets_locked`;
    if (rows.length !== ids.length)
      throw new TransferError('A selection is missing or its event is locked.');
    const legs = rows.map((r) => ({
      ...r,
      kickoffAt: new Date(r.kickoffAt).toISOString(),
      odds:
        r.available && r.odds != null && Number.isFinite(r.odds) && Math.abs(r.odds) >= 100
          ? r.odds
          : null,
      pricingStatus:
        r.available && r.odds != null && Number.isFinite(r.odds) && Math.abs(r.odds) >= 100
          ? ('stored' as const)
          : ('unknown' as const),
      oddsUpdatedAt: r.oddsUpdatedAt ? new Date(r.oddsUpdatedAt).toISOString() : '',
    }));
    try {
      eligibleTransfer(legs, Date.now(), book);
    } catch (e) {
      throw new TransferError((e as Error).message);
    }
    return legs;
  }
  const state = (j: Job): TransferState => ({
    id: j.id,
    status: j.status,
    expiresAt: j.expires_at.toISOString(),
    ...(j.status === 'complete' && j.url ? { url: j.url, directionVerified: false as const } : {}),
    ...(j.error ? { error: j.error } : {}),
  });
  async function start(
    user: string,
    ids: string[],
    region = 'UNSPECIFIED',
    book: Sportsbook = 'fanduel',
    approved?: TransferLeg[],
  ) {
    if (!['IA', 'UNSPECIFIED'].includes(region))
      throw new TransferError('Unable to resolve the sportsbook region safely.');
    const legs = await resolve(ids, book),
      who = actor(user),
      fp = fingerprint(ids, region, book),
      limits = transferLimits();
    if (
      approved &&
      (!sameSelections(legs, approved) ||
        legs.some((l) => approved.find((a) => a.id === l.id)?.odds !== l.odds))
    )
      throw new TransferError('Stored selections changed. Review the sportsbook proposal again.');
    const reservation = await db.begin(async (tx) => {
      await tx`SELECT pg_advisory_xact_lock(724815103)`;
      await tx`UPDATE fanduel_transfer_jobs SET status='failed',url=NULL,error='Preparation expired. Your parlay has been preserved.' WHERE expires_at<=now() AND status IN ('submitting','pending','complete')`;
      const existing = await tx<
        Job[]
      >`SELECT * FROM fanduel_transfer_jobs WHERE actor=${who} AND fingerprint=${fp} AND expires_at>now() ORDER BY created_at DESC LIMIT 1`;
      if (existing[0]) return { job: existing[0], submit: false };
      const active =
        await tx`SELECT id FROM fanduel_transfer_jobs WHERE actor=${who} AND status IN ('submitting','pending','failed') AND expires_at>now() LIMIT 1`;
      if (active.length)
        throw new TransferError(
          'You already have a recent Sportsbook preparation reserved. Wait briefly before preparing another slip.',
          409,
        );
      const [c] =
        await tx`SELECT count(*) FILTER(WHERE actor=${who} AND created_at>=date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')::int AS "user",count(*) FILTER(WHERE created_at>=date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')::int AS "global",count(*) FILTER(WHERE status IN ('submitting','pending','failed') AND expires_at>now())::int AS active FROM fanduel_transfer_jobs`;
      const reason = quotaReason(c as { user: number; global: number; active: number }, limits);
      if (reason) throw new TransferError(reason, 429);
      const [job] = await tx<
        Job[]
      >`INSERT INTO fanduel_transfer_jobs(id,actor,fingerprint,region,sportsbook,legs,status,expires_at) VALUES(${randomUUID()},${who},${fp},${region},${book},${tx.json(JSON.parse(JSON.stringify(legs)))},'submitting',now()+interval '90 seconds') RETURNING *`;
      return { job, submit: true };
    });
    if (!reservation.submit)
      return reservation.job.status === 'complete'
        ? poll(user, reservation.job.id, book)
        : state(reservation.job);
    const job = reservation.job;
    // Reservation is durable before the sole POST. Ambiguous submission failures consume budget, never auto-retry.
    try {
      const result = await client.generateSlip(generationPrompt(legs, region, book));
      if (result.status.toLowerCase() !== 'pending' || !result.requestId)
        throw Error('Not accepted');
      const [saved] = await db<
        Job[]
      >`UPDATE fanduel_transfer_jobs SET status='pending',request_id=${result.requestId},next_poll_at=now()+interval '2 seconds' WHERE id=${job.id} RETURNING *`;
      return state(saved);
    } catch (e) {
      const message =
        e instanceof UnabatedError && e.status === 429
          ? 'Sportsbook preparation is temporarily rate limited. Please try later.'
          : transferFailure.replaceAll('FanDuel', sportsbookConfig[book].name);
      await db`UPDATE fanduel_transfer_jobs SET status='failed',error=${message} WHERE id=${job.id}`;
      return { id: job.id, status: 'failed' as const, error: message };
    }
  }
  async function poll(user: string, id: string, book: Sportsbook = 'fanduel') {
    return db.begin(async (tx) => {
      const [job] = await tx<
        Job[]
      >`SELECT * FROM fanduel_transfer_jobs WHERE id=${id} AND actor=${actor(user)} AND sportsbook=${book} FOR UPDATE`;
      if (!job) throw new TransferError('Preparation not found.', 404);
      if (job.expires_at.getTime() <= Date.now() || job.poll_count >= 25) {
        await tx`UPDATE fanduel_transfer_jobs SET status='failed',url=NULL,error='Preparation timed out. Your parlay has been preserved.' WHERE id=${id}`;
        return {
          id,
          status: 'failed' as const,
          error: 'Preparation timed out. Your parlay has been preserved.',
        };
      }
      if (job.status === 'failed') return state(job);
      // Recheck canonical selection identity and event expiry; target-book pricing may be absent.
      if (job.status === 'complete') {
        try {
          const fresh = await resolve(
            job.legs.map((l) => l.id),
            book,
          );
          if (!sameSelections(fresh, job.legs)) throw Error('Selection changed');
          return state(job);
        } catch {
          return {
            id,
            status: 'failed' as const,
            error: transferFailure.replaceAll('FanDuel', sportsbookConfig[book].name),
          };
        }
      }
      if (job.status === 'submitting' || job.next_poll_at.getTime() > Date.now()) return state(job);
      await tx`UPDATE fanduel_transfer_jobs SET poll_count=poll_count+1,api_calls=api_calls+1,next_poll_at=now()+interval '2 seconds' WHERE id=${id}`;
      try {
        const result = await client.slipStatus(job.request_id!);
        if (result.status.toLowerCase() === 'processing') return state(job);
        if (result.status.toLowerCase() !== 'complete') throw Error('Provider failed');
        const legs = await resolve(
          job.legs.map((l) => l.id),
          book,
        );
        // Identity must remain unchanged since submission, even if the underlying data changed.
        if (
          legs.some(
            (l) =>
              !job.legs.some(
                (o) =>
                  o.id === l.id &&
                  o.playerId === l.playerId &&
                  o.playerName === l.playerName &&
                  o.eventId === l.eventId &&
                  o.marketType === l.marketType &&
                  o.period === l.period &&
                  o.side === l.side &&
                  o.line === l.line &&
                  o.kickoffAt === l.kickoffAt,
              ),
          )
        )
          throw Error('Selection changed');
        const slips = result.betSlips?.filter(
          (s) => s.book === sportsbookConfig[book].unabatedName,
        );
        if (slips?.length !== 1) throw Error('No complete slip');
        if (job.expires_at.getTime() <= Date.now()) throw Error('Preparation expired');
        const checked = validateTestCandidate(
          legs,
          slips[0],
          job.region,
          process.env.UNABATED_PARTNER_CODE!,
          book,
        );
        await tx`UPDATE fanduel_transfer_jobs SET status='complete',url=${checked.url} WHERE id=${id}`;
        return {
          id,
          status: 'complete' as const,
          expiresAt: job.expires_at.toISOString(),
          ...checked,
        };
      } catch (e) {
        const error =
          e instanceof UnresolvedTransferRegion
            ? e.message
            : e instanceof UnabatedError && e.status === 429
              ? 'Sportsbook preparation is temporarily rate limited. Please try later.'
              : transferFailure.replaceAll('FanDuel', sportsbookConfig[book].name);
        await tx`UPDATE fanduel_transfer_jobs SET status='failed',url=NULL,error=${error} WHERE id=${id}`;
        return { id, status: 'failed' as const, error };
      }
    });
  }
  return { start, poll, resolve };
}

function sameSelections(fresh: TransferLeg[], old: TransferLeg[]) {
  return fresh.every((l) =>
    old.some(
      (o) =>
        o.id === l.id &&
        o.playerId === l.playerId &&
        o.playerName === l.playerName &&
        o.eventId === l.eventId &&
        o.marketType === l.marketType &&
        o.period === l.period &&
        o.side === l.side &&
        o.line === l.line &&
        o.kickoffAt === l.kickoffAt,
    ),
  );
}
