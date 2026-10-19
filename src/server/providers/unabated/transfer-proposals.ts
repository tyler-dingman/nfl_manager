import{applicationBackend,applicationStorage,applicationEnvironment}from'../../persistence/bindings';
import{D1TransferProposals}from'../../../../packages/storage/sportsbook-transfers';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { authDb } from '../../auth/database';
import { classifyStoredLine } from '../../odds/line-classification';
import { MAX_ALT_ODDS } from '../../../../packages/parlay/discovery-preferences';
import {
  defaultSubstitutionPolicy,
  resolveSportsbookCompatibility,
  sportsbookConfig,
  type Sportsbook,
  type TransferProposal,
  type MatchLeg,
} from '../../../../packages/parlay/sportsbook-transfer';
import { TransferError } from './transfer-service';
import type { TransferLeg } from './test-transfer-validation';

export function substitutionPolicy(env = applicationEnvironment()) {
  return {
    differences: Object.fromEntries(
      Object.entries(defaultSubstitutionPolicy.differences).map(([key, fallback]) => {
        const n = Number(env['TRANSFER_MAX_DIFF_' + key] ?? fallback);
        return [key, Number.isFinite(n) && n >= 0 ? n : 0];
      }),
    ),
    minOdds: MAX_ALT_ODDS.includes(
      Number(env.TRANSFER_MIN_SUBSTITUTE_ODDS ?? -800) as (typeof MAX_ALT_ODDS)[number],
    )
      ? Number(env.TRANSFER_MIN_SUBSTITUTE_ODDS ?? -800)
      : 0,
  };
}
const signature = (value: string) =>
  createHmac('sha256', applicationEnvironment().AUTH_JWT_SECRET!)
    .update('sportsbook-proposal:' + value)
    .digest('base64url');
const stamp = (matches: TransferProposal['matches']) =>
  matches.map(({ original: o, selection: s }) => [
    o.id,
    o.eventId,
    o.playerId,
    o.marketType,
    o.side,
    o.period,
    o.line,
    o.kickoffAt,
    s.id,
    s.playerName,
    s.line,
    s.odds,
    s.sportsbook,
    s.oddsUpdatedAt,
    s.pricingStatus,
    s.kickoffAt,
  ]);
export function sealProposal(
  user: string,
  p: Omit<TransferProposal, 'token' | 'expiresAt'>,
  expires = Date.now() + 300000,
) {
  const body = Buffer.from(
    JSON.stringify({
      user,
      book: p.sportsbook,
      ids: p.matches.map((m) => m.original.id),
      stamp: stamp(p.matches),
      expires,
    }),
  ).toString('base64url');
  return { ...p, token: body + '.' + signature(body), expiresAt: new Date(expires).toISOString() };
}
export function readProposalToken(user: string, book: Sportsbook, token: string) {
  try {
    const [body, sig, extra] = token.split('.');
    const wanted = signature(body),
      actual = Buffer.from(sig ?? '');
    if (extra || actual.length !== wanted.length || !timingSafeEqual(actual, Buffer.from(wanted)))
      throw Error();
    const data = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (
      data.user !== user ||
      data.book !== book ||
      !(data.expires > Date.now()) ||
      !Array.isArray(data.ids)
    )
      throw Error();
    return data as {
      user: string;
      book: Sportsbook;
      ids: string[];
      stamp: unknown;
      expires: number;
    };
  } catch {
    throw new TransferError(
      'This sportsbook proposal expired or changed. Check availability again.',
      409,
    );
  }
}
export function createProposalService(inputDb?:ReturnType<typeof authDb>){
 if(!inputDb&&applicationBackend()==='d1'){const d=new D1TransferProposals(applicationStorage('D1_USERS'));return{inspect:d.inspect.bind(d),propose:d.propose.bind(d),approve:d.approve.bind(d)};}
 const db=inputDb??authDb();
  async function inspect(user: string, ids: string[], book: Sportsbook, enabled = true) {
    if (!ids.length || ids.length > 20 || new Set(ids).size !== ids.length)
      throw new TransferError('Invalid selections.');
    const originals = await db<
      TransferLeg[]
    >`SELECT m.id,m.event_id AS "eventId",m.player_id AS "playerId",pm.provider_name AS "playerName",m.team_id AS "teamId",m.market_type AS "marketType",m.period,m.side,m.line::float8,e.kickoff_at AS "kickoffAt",e.home_team_id AS "homeTeamId",e.away_team_id AS "awayTeamId" FROM bet_markets m JOIN sportsbook_events e ON e.id=m.event_id JOIN provider_player_mappings pm ON pm.provider=e.provider AND pm.provider_player_id=m.entity_id AND pm.player_id=m.player_id WHERE m.id IN ${db(ids)} AND e.provider='SPORTSGAMEODDS' AND NOT e.markets_locked`;

    // Stored deeplinks are deliberately irrelevant: Unabated generates its own complete-slip
    // URL. A missing provider URL must never exclude an otherwise eligible sportsbook offer.
    const candidates = await db<
      (TransferLeg & { isAltLine: boolean; rawProviderMetadata: unknown })[]
    >`SELECT DISTINCT m.id,m.event_id AS "eventId",m.player_id AS "playerId",pm.provider_name AS "playerName",m.team_id AS "teamId",m.market_type AS "marketType",m.period,m.side,m.line::float8,m.is_alt_line AS "isAltLine",m.raw_provider_metadata AS "rawProviderMetadata",p.odds,p.sportsbook,p.available,p.updated_at AS "oddsUpdatedAt",e.kickoff_at AS "kickoffAt",e.home_team_id AS "homeTeamId",e.away_team_id AS "awayTeamId" FROM bet_markets o JOIN bet_markets m ON m.event_id=o.event_id AND m.player_id=o.player_id AND m.market_type=o.market_type AND m.side=o.side AND m.period=o.period JOIN sportsbook_events e ON e.id=m.event_id JOIN provider_player_mappings pm ON pm.provider=e.provider AND pm.provider_player_id=m.entity_id AND pm.player_id=m.player_id JOIN sportsbook_prices p ON p.market_id=m.id WHERE o.id IN ${db(ids)} AND e.provider='SPORTSGAMEODDS' AND NOT e.markets_locked AND p.sportsbook=${sportsbookConfig[book].stored} AND p.available`;
    const clean = (l: TransferLeg): MatchLeg => ({
      ...l,
      kickoffAt: new Date(l.kickoffAt).toISOString(),
      ...(l.oddsUpdatedAt ? { oddsUpdatedAt: new Date(l.oddsUpdatedAt).toISOString() } : {}),
    });
    const ordered = ids.flatMap((id) => {
      const leg = originals.find((l) => l.id === id);
      return leg ? [clean(leg)] : [];
    });
    const offers = candidates.map((l) => {
      const { rawProviderMetadata, isAltLine, ...rest } = l;
      return {
        ...clean(rest),
        ...classifyStoredLine({
          sportsbook: l.sportsbook,
          line: l.line,
          isAltLine,
          rawProviderMetadata,
        }),
      };
    });
    const result = resolveSportsbookCompatibility(
      ordered,
      offers,
      book,
      enabled,
      substitutionPolicy(),
      Date.now(),
      ids.length,
    );
    return {
      compatibility: result.compatibility,
      proposal: result.proposal ? sealProposal(user, result.proposal) : null,
    };
  }
  async function propose(user: string, ids: string[], book: Sportsbook) {
    return (await inspect(user, ids, book)).proposal;
  }
  async function approve(user: string, book: Sportsbook, token: string, approved: boolean) {
    const signed = readProposalToken(user, book, token);
    const fresh = await propose(user, signed.ids, book);
    if (!fresh || JSON.stringify(stamp(fresh.matches)) !== JSON.stringify(signed.stamp))
      throw new TransferError(
        'Stored lines or prices changed. Review the sportsbook proposal again.',
        409,
      );
    if (fresh.adjustments && !approved)
      throw new TransferError('Approve the line adjustments before preparing this slip.', 409);
    return fresh.matches.map((m) => m.selection) as TransferLeg[];
  }
  return { propose, inspect, approve };
}
