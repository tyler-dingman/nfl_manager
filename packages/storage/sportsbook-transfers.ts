import { createHmac } from 'node:crypto';
import { Storage, objectKey } from './core';
import { JsonTree } from './json-tree';
import { guardedBatch } from './atomic';
import { D1OddsBoard } from './odds-board';
import { applicationEnvironment } from '../../src/server/persistence/bindings';
import { UnabatedClient, UnabatedError } from '../../src/server/providers/unabated/client';
import {
  TransferError,
  fingerprint,
  quotaReason,
  transferLimits,
} from '../../src/server/providers/unabated/transfer-service';
import {
  eligibleTransfer,
  generationPrompt,
  validateTestCandidate,
  UnresolvedTransferRegion,
  type TransferLeg,
} from '../../src/server/providers/unabated/test-transfer-validation';
import { transferFailure, type TransferState } from '../parlay/fanduel-transfer';
import {
  sportsbookConfig,
  resolveSportsbookCompatibility,
  type Sportsbook,
  type MatchLeg,
} from '../parlay/sportsbook-transfer';
import {
  substitutionPolicy,
  sealProposal,
  readProposalToken,
} from '../../src/server/providers/unabated/transfer-proposals';
const same = (a: TransferLeg[], b: TransferLeg[]) =>
  a.length === b.length &&
  a.every((l) =>
    b.some(
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
export async function storedTransferLegs(s: Storage, ids?: string[]) {
  const heads = await s.rows<any>(
    `SELECT * FROM app_sportsbook_events WHERE kickoff_at>? AND markets_locked=0 AND markets_hash IS NOT NULL ${s.owner === 'D1_SHARED' && ids ? "AND(market_lookup_json='[]' OR EXISTS(SELECT 1 FROM json_each(market_lookup_json) WHERE value IN(SELECT value FROM json_each(?))))" : ''}`,
    [Date.now(), ...(s.owner === 'D1_SHARED' && ids ? [JSON.stringify(ids)] : [])],
  );
  await s.objects.prefetch?.(heads.map((h) => objectKey(h.markets_hash)));
  const envelopes = await Promise.all(
    heads.map(async (h) => {
      const v = await s.get<any>(h.markets_hash);
      if (v.schema !== 1 || v.eventId !== h.id) throw Error('Odds board identity mismatch');
      return v;
    }),
  );
  await s.objects.prefetch?.(envelopes.map((v) => objectKey(v.root)));
  const rows: MatchLeg[] = [];
  for (let i = 0; i < heads.length; i++) {
    const e = heads[i],
      markets = await new JsonTree(s).get<any[]>(envelopes[i].root);
    for (const m of markets) {
      if (!m.playerId || !m.playerName) continue;
      rows.push({
        ...m,
        eventId: e.id,
        homeTeamId: e.home_team_id,
        awayTeamId: e.away_team_id,
        kickoffAt: new Date(e.kickoff_at).toISOString(),
        oddsUpdatedAt: e.as_of == null ? '' : new Date(e.as_of).toISOString(),
        odds: m.available && Number.isFinite(m.odds) && Math.abs(m.odds) >= 100 ? m.odds : null,
        pricingStatus:
          m.available && Number.isFinite(m.odds) && Math.abs(m.odds) >= 100 ? 'stored' : 'unknown',
      });
    }
  }
  return rows;
}
export class D1TransferProposals {
  constructor(readonly s: Storage) {}
  async inspect(user: string, ids: string[], book: Sportsbook, enabled = true) {
    if (!ids.length || ids.length > 20 || new Set(ids).size !== ids.length)
      throw new TransferError('Invalid selections.');
    const all = await storedTransferLegs(this.s, ids),
      originals = ids.flatMap((id) => {
        const m = all.find((l) => l.id === id);
        return m ? [m] : [];
      }),
      offers = all.filter((l) => l.sportsbook === sportsbookConfig[book].stored && l.available),
      result = resolveSportsbookCompatibility(
        originals,
        offers,
        book,
        enabled,
        substitutionPolicy(applicationEnvironment()),
        Date.now(),
        ids.length,
      );
    return {
      compatibility: result.compatibility,
      proposal: result.proposal ? sealProposal(user, result.proposal) : null,
    };
  }
  async propose(user: string, ids: string[], book: Sportsbook) {
    return (await this.inspect(user, ids, book)).proposal;
  }
  async approve(user: string, book: Sportsbook, token: string, approved: boolean) {
    const signed = readProposalToken(user, book, token),
      fresh = await this.propose(user, signed.ids, book);
    if (
      !fresh ||
      JSON.stringify(readProposalToken(user, book, fresh.token).stamp) !==
        JSON.stringify(signed.stamp)
    )
      throw new TransferError(
        'Stored lines or prices changed. Review the sportsbook proposal again.',
        409,
      );
    if (fresh.adjustments && !approved)
      throw new TransferError('Approve the line adjustments before preparing this slip.', 409);
    return fresh.matches.map((m) => m.selection) as TransferLeg[];
  }
}
export class D1Transfers {
  constructor(
    readonly s: Storage,
    readonly client = new UnabatedClient(),
    readonly odds: Storage = s,
  ) {}
  actor(user: string) {
    return createHmac('sha256', applicationEnvironment().AUTH_JWT_SECRET!)
      .update('fanduel:' + user)
      .digest('hex');
  }
  async resolve(ids: string[], book: Sportsbook = 'fanduel') {
    const all = await storedTransferLegs(this.odds, ids),
      legs = ids.flatMap((id) => {
        const row = all.find(
          (r) => r.id === id && r.sportsbook === sportsbookConfig[book].stored && r.available,
        );
        return row ? [row as TransferLeg] : [];
      });
    if (legs.length !== ids.length)
      throw new TransferError('A selection is missing or its event is locked.');
    try {
      eligibleTransfer(legs, Date.now(), book);
    } catch (e) {
      throw new TransferError((e as Error).message);
    }
    return legs;
  }
  state(j: any): TransferState {
    return {
      id: j.id,
      status: j.status,
      expiresAt: new Date(j.expires_at).toISOString(),
      ...(j.status === 'complete' && j.url
        ? { url: j.url, directionVerified: false as const }
        : {}),
      ...(j.error ? { error: j.error } : {}),
    };
  }
  async start(
    user: string,
    ids: string[],
    region = 'UNSPECIFIED',
    book: Sportsbook = 'fanduel',
    approved?: TransferLeg[],
  ): Promise<TransferState> {
    if (!['IA', 'UNSPECIFIED'].includes(region))
      throw new TransferError('Unable to resolve the sportsbook region safely.');
    const legs = await this.resolve(ids, book);
    if (
      approved &&
      (!same(legs, approved) ||
        legs.some((l) => approved.find((a) => a.id === l.id)?.odds !== l.odds))
    )
      throw new TransferError('Stored selections changed. Review the sportsbook proposal again.');
    const who = this.actor(user),
      fp = fingerprint(ids, region, book),
      limits = transferLimits(),
      now = Date.now(),
      day = new Date().setUTCHours(0, 0, 0, 0);
    for (let attempt = 0; attempt < 5; attempt++) {
      const [old] = await this.s.rows<any>(
        'SELECT * FROM app_sportsbook_transfer_jobs WHERE actor=? AND fingerprint=? AND expires_at>? ORDER BY created_at DESC LIMIT 1',
        [who, fp, now],
      );
      if (old) return old.status === 'complete' ? this.poll(user, old.id, book) : this.state(old);
      const [c] = await this.s.rows<any>(
          "SELECT count(*) FILTER(WHERE actor=? AND created_at>=?) AS user,count(*) FILTER(WHERE created_at>=?) AS global,count(*) FILTER(WHERE status IN('submitting','pending','failed') AND expires_at>?) AS active FROM app_sportsbook_transfer_jobs",
          [who, day, day, now],
        ),
        reason = quotaReason(c, limits);
      if (reason) throw new TransferError(reason, 429);
      if (
        (
          await this.s.rows(
            "SELECT 1 FROM app_sportsbook_transfer_jobs WHERE actor=? AND status IN('submitting','pending','failed') AND expires_at>?",
            [who, now],
          )
        ).length
      )
        throw new TransferError('You already have a recent Sportsbook preparation reserved.', 409);
      const id = crypto.randomUUID(),
        hash = await this.s.put({ schema: 1, id, actor: who, legs });
      try {
        await guardedBatch(
          this.s,
          [
            {
              sql: "NOT EXISTS(SELECT 1 FROM app_sportsbook_transfer_jobs WHERE actor=? AND expires_at>?) AND(SELECT count(*) FROM app_sportsbook_transfer_jobs WHERE actor=? AND created_at>=?)<? AND(SELECT count(*) FROM app_sportsbook_transfer_jobs WHERE created_at>=?)<? AND(SELECT count(*) FROM app_sportsbook_transfer_jobs WHERE status IN('submitting','pending','failed') AND expires_at>?)<?",
              values: [who, now, who, day, limits.user, day, limits.global, now, limits.concurrent],
            },
          ],
          [
            this.s.statement(
              "INSERT INTO app_sportsbook_transfer_jobs(id,sportsbook,actor,fingerprint,region,object_hash,status,created_at,expires_at,next_poll_at) VALUES(?,?,?,?,?,?,'submitting',?,?,?)",
              [id, book, who, fp, region, hash, now, now + 90000, now],
            ),
          ],
        );
      } catch (e) {
        if (attempt < 4 && /State changed/.test(String(e))) continue;
        throw e;
      }
      try {
        const result = await this.client.generateSlip(generationPrompt(legs, region, book));
        if (result.status.toLowerCase() !== 'pending' || !result.requestId)
          throw Error('Not accepted');
        const [j] = await this.s.rows<any>(
          "UPDATE app_sportsbook_transfer_jobs SET status='pending',request_id=?,next_poll_at=?,version=version+1 WHERE id=? RETURNING *",
          [result.requestId, Date.now() + 2000, id],
        );
        return this.state(j);
      } catch (e) {
        const error =
          e instanceof UnabatedError && e.status === 429
            ? 'Sportsbook preparation is temporarily rate limited. Please try later.'
            : transferFailure.replaceAll('FanDuel', sportsbookConfig[book].name);
        await this.s
          .statement(
            "UPDATE app_sportsbook_transfer_jobs SET status='failed',error=?,version=version+1 WHERE id=?",
            [error, id],
          )
          .run();
        return { id, status: 'failed' as const, error };
      }
    }
    throw new TransferError('Sportsbook preparation is busy.', 409);
  }
  async poll(user: string, id: string, book: Sportsbook = 'fanduel'): Promise<TransferState> {
    const [j] = await this.s.rows<any>(
      'SELECT * FROM app_sportsbook_transfer_jobs WHERE id=? AND actor=? AND sportsbook=?',
      [id, this.actor(user), book],
    );
    if (!j) throw new TransferError('Preparation not found.', 404);
    const fail = async (error: string) => {
      await this.s
        .statement(
          "UPDATE app_sportsbook_transfer_jobs SET status='failed',url=NULL,error=?,version=version+1 WHERE id=? AND version=?",
          [error, id, j.version],
        )
        .run();
      return { id, status: 'failed' as const, error };
    };
    if (j.expires_at <= Date.now() || j.poll_count >= 25)
      return fail('Preparation timed out. Your parlay has been preserved.');
    if (j.status === 'failed' || j.status === 'submitting') return this.state(j);
    const p = await this.s.get<any>(j.object_hash);
    if (p.schema !== 1 || p.id !== id || p.actor !== j.actor)
      throw Error('Transfer identity mismatch');
    const fresh = async () => {
      const legs = await this.resolve(
        p.legs.map((l: TransferLeg) => l.id),
        book,
      );
      if (!same(legs, p.legs)) throw Error('Selection changed');
      return legs;
    };
    if (j.status === 'complete') {
      try {
        await fresh();
        return this.state(j);
      } catch {
        return fail(transferFailure);
      }
    }
    if (j.next_poll_at > Date.now()) return this.state(j);
    const claimed = await this.s
      .statement(
        'UPDATE app_sportsbook_transfer_jobs SET poll_count=poll_count+1,api_calls=api_calls+1,next_poll_at=?,version=version+1 WHERE id=? AND version=? AND expires_at>? RETURNING version',
        [Date.now() + 2000, id, j.version, Date.now()],
      )
      .first<any>();
    if (!claimed) return this.state(j);
    j.version = claimed.version;
    try {
      const result = await this.client.slipStatus(j.request_id);
      if (result.status.toLowerCase() === 'processing') return this.state(j);
      if (result.status.toLowerCase() !== 'complete') throw Error('Provider failed');
      const legs = await fresh(),
        slips = result.betSlips?.filter((s) => s.book === sportsbookConfig[book].unabatedName);
      if (slips?.length !== 1 || j.expires_at <= Date.now())
        throw Error('Incomplete or expired preparation');
      const checked = validateTestCandidate(
        legs,
        slips[0],
        j.region,
        applicationEnvironment().UNABATED_PARTNER_CODE!,
        book,
      );
      const saved = await this.s
        .statement(
          "UPDATE app_sportsbook_transfer_jobs SET status='complete',url=?,version=version+1 WHERE id=? AND version=? AND expires_at>? RETURNING id",
          [checked.url, id, j.version, Date.now()],
        )
        .first();
      if (!saved) throw Error('Preparation changed or expired');
      return {
        id,
        status: 'complete' as const,
        expiresAt: new Date(j.expires_at).toISOString(),
        ...checked,
      };
    } catch (e) {
      return fail(
        e instanceof UnresolvedTransferRegion
          ? e.message
          : e instanceof UnabatedError && e.status === 429
            ? 'Sportsbook preparation is temporarily rate limited. Please try later.'
            : transferFailure.replaceAll('FanDuel', sportsbookConfig[book].name),
      );
    }
  }
}
