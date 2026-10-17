import { slipKey, type SlipLeg } from '../../../../packages/parlay/slip';
export type VerifiedOffer = SlipLeg & {
  offerId: string;
  region: string;
  verifiedUntil: number;
};
/** Generated text output does not expose a reliable side/event/player identity.
 * Resolve returned offer IDs independently to current canonical selections first.
 * These offer IDs are NOT assumed to be marketLineIds or legacy provider IDs. */
export function verifyGeneratedFanDuelSlip(
  requested: SlipLeg[],
  result: {
    book: string;
    deepLink?: string | null;
    legsRequested: number;
    legsMatched: number;
    betslipBets?: Array<{
      id?: string | null;
      isLive: boolean;
      odds?: { points?: string | null } | null;
    }> | null;
  },
  resolved: VerifiedOffer[],
  options: { now: number; region: string },
): { supported: boolean; url?: string; reason?: string } {
  const no = (reason: string) => ({ supported: false, reason });
  if (
    !requested.length ||
    result.book !== 'FanDuel' ||
    result.legsRequested !== requested.length ||
    result.legsMatched !== requested.length ||
    result.betslipBets?.length !== requested.length
  )
    return no('Incomplete FanDuel slip.');
  const matches: string[] = [];
  for (const bet of result.betslipBets) {
    const offers = resolved.filter(
      (r) => r.offerId === bet.id && r.sportsbook === 'FANDUEL' && r.region === options.region,
    );
    if (bet.isLive || offers.length !== 1)
      return no('Returned offer identity or direction is unverified.');
    const offer = offers[0];
    if (!offer.available || !(offer.verifiedUntil > options.now))
      return no('Returned offer is unavailable or expired.');
    const points = bet.odds?.points;
    if (
      offer.line !== null &&
      (points == null ||
        points.trim() === '' ||
        !Number.isFinite(Number(points)) ||
        Number(points) !== offer.line)
    )
      return no('Returned threshold does not match.');
    const identity = slipKey(offer);
    if (!requested.some((r) => slipKey(r) === identity) || matches.includes(identity))
      return no('Returned selection does not match every requested leg.');
    matches.push(identity);
  }
  if (new Set(requested.map(slipKey)).size !== requested.length)
    return no('Duplicate requested selections.');
  try {
    const url = new URL(result.deepLink ?? '');
    if (
      url.protocol !== 'https:' ||
      !['gambly.com', 'www.gambly.com'].includes(url.hostname) ||
      url.port ||
      url.username ||
      url.password ||
      !url.pathname.startsWith('/deeplink/deeplink-cache-')
    )
      return no('No supported generated slip URL.');
    return { supported: true, url: result.deepLink! };
  } catch {
    return no('Invalid generated slip URL.');
  }
}
