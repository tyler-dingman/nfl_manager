import { sportsbookConfig, type Sportsbook } from '../../../../packages/parlay/sportsbook-transfer';
import { transferMarkets, transferEligibility } from '../../../../packages/parlay/fanduel-transfer';
import { matchesTransferMarket } from '../../../../packages/parlay/transfer-markets';
import type { SlipLeg } from '../../../../packages/parlay/slip';
import type { GeneratedSlip } from './types';
export class UnresolvedTransferRegion extends Error {
  constructor() {
    super(
      'The sportsbook returned a region-specific selection that cannot be verified. Your parlay has been preserved.',
    );
  }
}
export type TransferLeg = SlipLeg & {
  eventId: string;
  playerId: string;
  playerName: string;
  kickoffAt: string;
  homeTeamId: string;
  awayTeamId: string;
  oddsUpdatedAt: string;
};
export function eligibleTransfer(
  legs: TransferLeg[],
  now = Date.now(),
  book: Sportsbook = 'fanduel',
) {
  const reason = transferEligibility(legs, book);
  if (reason) throw Error(reason);
  if (legs.some((l) => !Number.isFinite(Date.parse(l.kickoffAt)) || Date.parse(l.kickoffAt) <= now))
    throw Error('An event has started or expired. Remove that selection.');
}
export function generationPrompt(
  legs: TransferLeg[],
  region = 'UNSPECIFIED',
  book: Sportsbook = 'fanduel',
) {
  if (!['IA', 'UNSPECIFIED'].includes(region))
    throw Error('Unable to resolve the sportsbook region safely.');
  return (
    `Generate ONE ${sportsbookConfig[book].unabatedName} bet slip with exactly all these NFL selections. ` +
    (region === 'IA' ? 'Region: Iowa. ' : '') +
    (new Set(legs.map((l) => l.eventId)).size < legs.length
      ? 'Include the same-game selections together in this ONE complete slip, including any legs from other games. Do not split them into separate slips. The sportsbook determines correlated pricing. '
      : '') +
    'Full game only. Do not omit or substitute any player, game, direction, market or exact threshold. Return no match for unavailable selections.\n' +
    legs
      .map(
        (l, i) =>
          `${i + 1}. Player: ${l.playerName}; game: ${l.awayTeamId} at ${l.homeTeamId}; kickoff ${l.kickoffAt}; ${l.side} ${l.line} ${transferMarkets[l.marketType]}; Full Game.`,
      )
      .join('\n')
  );
}
export function attributedGeneratedUrl(
  value: string,
  partner: string,
  book: Sportsbook = 'fanduel',
) {
  const u = new URL(value);
  if (
    u.protocol !== 'https:' ||
    !(sportsbookConfig[book].hosts as readonly string[]).includes(u.hostname) ||
    u.port ||
    u.username ||
    u.password ||
    !sportsbookConfig[book].path.test(u.pathname) ||
    !/^[a-z0-9_-]+$/i.test(partner)
  )
    throw Error('Invalid generated URL.');
  const codes = u.searchParams.getAll('utm_campaign');
  if (codes.some((c) => c !== partner)) throw Error('Unexpected partner attribution.');
  u.searchParams.set('utm_campaign', partner);
  return u.toString();
}
/** Deliberately separate from strict independent-offer validation. Development candidates only. */
export function validateTestCandidate(
  legs: TransferLeg[],
  slip: GeneratedSlip,
  region: string,
  partner: string,
  book: Sportsbook = 'fanduel',
) {
  eligibleTransfer(legs, Date.now(), book);
  if (
    !['IA', 'UNSPECIFIED'].includes(region) ||
    slip.book !== sportsbookConfig[book].unabatedName ||
    slip.legsRequested !== legs.length ||
    slip.legsMatched !== legs.length ||
    slip.betslipBets?.length !== legs.length
  )
    throw Error('Incomplete sportsbook match.');
  const seen = new Set<string>();
  const ids = new Set<string>();
  const aliases: Record<string, string> = { LAR: 'LA', JAX: 'JAC' };
  for (const bet of slip.betslipBets) {
    const named = legs.filter(
      (l) => l.playerName.trim().toLowerCase() === bet.player?.trim().toLowerCase(),
    );
    const matches =
      named.length <= 1
        ? named
        : named.filter(
            (l) =>
              matchesTransferMarket(l.marketType, bet.betType) &&
              bet.odds?.points != null &&
              bet.odds.points.trim() !== '' &&
              Number(bet.odds.points) === l.line &&
              Date.parse(bet.metadata?.timestamp ?? '') === Date.parse(l.kickoffAt) &&
              ((bet.direction ?? bet.side ?? bet.metadata?.additionalInfo?.overUnder) == null ||
                String(
                  bet.direction ?? bet.side ?? bet.metadata?.additionalInfo?.overUnder,
                ).toUpperCase() === l.side),
          );
    if (matches.length !== 1) throw Error('Incorrect or ambiguous player.');
    const l = matches[0],
      parts = bet.event?.split(' @ ') ?? [];
    if (seen.has(l.id) || !bet.id || ids.has(bet.id)) throw Error('Duplicate selection.');
    seen.add(l.id);
    ids.add(bet.id);
    if (
      parts.length !== 2 ||
      !parts.every((p, i) => {
        const code = i ? l.homeTeamId : l.awayTeamId;
        return [code, aliases[code]].includes(p.trim().split(/\s+/).at(-1)!);
      }) ||
      Date.parse(bet.metadata?.timestamp ?? '') !== Date.parse(l.kickoffAt) ||
      bet.metadata?.league !== 'NFL'
    )
      throw Error('Incorrect game.');
    if (
      !matchesTransferMarket(l.marketType, bet.betType) ||
      bet.periodType !== 'Full Game' ||
      bet.isLive ||
      bet.deepLink?.sportsbook !== sportsbookConfig[book].unabatedName
    )
      throw Error('Incorrect market or period.');
    const points = bet.odds?.points;
    if (points == null || points.trim() === '' || Number(points) !== l.line)
      throw Error('Incorrect threshold.');
    const side = bet.direction ?? bet.side ?? bet.metadata?.additionalInfo?.overUnder;
    if (side != null && String(side).toUpperCase() !== l.side) throw Error('Incorrect direction.');
    const returnedRegion = bet.metadata?.additionalInfo?.region;
    if (
      returnedRegion != null &&
      (region !== 'IA' || !['IA', 'Iowa'].includes(String(returnedRegion)))
    )
      throw new UnresolvedTransferRegion();
  }
  return {
    url: attributedGeneratedUrl(slip.deepLink ?? '', partner, book),
    directionVerified: false as const,
  };
}
