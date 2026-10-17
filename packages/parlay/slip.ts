import { isAnytimeTD, propPick } from './anytime-td';
import { estimateParlayOdds } from '../../src/components/parlay-lab/parlay-odds';
export type SlipLeg = {
  id: string;
  eventId?: string;
  playerId?: string | null;
  playerName?: string | null;
  teamId?: string | null;
  marketType: string;
  period?: string;
  side: string;
  line: number | null;
  odds: number | null;
  sportsbook: string;
  available?: boolean;
  /** Unknown target-book pricing is an exact-match request, not a confirmed offer. */
  pricingStatus?: 'stored' | 'unknown';
  deeplink?: string | null;
  headshotUrl?: string | null;
  trend?: { trendScore?: number } | null;
};
export const slipKey = (m: SlipLeg) =>
  [
    m.eventId ?? '',
    m.playerId ?? m.playerName ?? m.teamId,
    m.marketType,
    m.period ?? 'game',
    m.side,
    m.line,
  ].join('|');
/** One selection per player/stat/period: also prevents opposing or overlapping thresholds. */
export function addSlipLeg<T extends SlipLeg>(legs: T[], leg: T): T[] {
  if (legs.some((m) => slipKey(m) === slipKey(leg))) return legs;
  const conflict = (m: T) =>
    m.eventId === leg.eventId &&
    (m.playerId ?? m.playerName ?? m.teamId) === (leg.playerId ?? leg.playerName ?? leg.teamId) &&
    m.marketType === leg.marketType &&
    (m.period ?? 'game') === (leg.period ?? 'game');
  return [...legs.filter((m) => !conflict(m)), leg];
}
export const slipOdds = (legs: SlipLeg[]) => estimateParlayOdds(legs.map((m) => m.odds));
export const displayOdds = (v: number | null | undefined) =>
  v == null ? '—' : `${v > 0 ? '+' : ''}${v}`;
export const slipPick = (m: SlipLeg) =>
  isAnytimeTD(m)
    ? `Anytime TD — ${propPick(m)}`
    : `${m.marketType.replaceAll('_', ' ')} — ${m.side} ${m.line ?? ''}`;
export const slipText = (legs: SlipLeg[], date = new Date()) =>
  [
    'DOWN & DISTANCE · MY PARLAY',
    ...legs.map(
      (m) =>
        `${m.playerName ?? m.teamId} · ${slipPick(m)} · ${displayOdds(m.odds)} · Lab Score ${m.trend?.trendScore ?? '—'}`,
    ),
    `Estimated combined odds: ${displayOdds(slipOdds(legs))}`,
    `Generated ${date.toISOString().slice(0, 10)}. Odds and availability may change.`,
    'https://downdistance.com/parlay-lab',
  ].join('\n');
export type FullSlipTransfer = {
  sportsbook: string;
  name: string;
  url: string;
  selectionKeys: string[];
};
export type SlipTransferIntegration = {
  sportsbook: string;
  name: string;
  verifyAndBuild: (legs: SlipLeg[], offers: SlipLeg[]) => FullSlipTransfer | null;
};
/** Only exact, selection-bearing links are supported. Never reuse a parent market link
 * for an alternate line or treat a single-selection URL as a multi-leg transfer. */
export const verifiedSlipIntegrations: SlipTransferIntegration[] = [
  {
    sportsbook: 'FANDUEL',
    name: 'FanDuel',
    verifyAndBuild(legs, offers) {
      if (legs.length !== 1) return null;
      for (const offer of offers) {
        if (
          !offer.available ||
          offer.sportsbook !== 'FANDUEL' ||
          slipKey(offer) !== slipKey(legs[0]) ||
          !offer.deeplink
        )
          continue;
        try {
          const url = new URL(offer.deeplink);
          if (
            url.protocol !== 'https:' ||
            url.hostname !== 'sportsbook.fanduel.com' ||
            url.port ||
            url.username ||
            url.password ||
            url.pathname !== '/addToBetslip'
          )
            continue;
          const entries = [...url.searchParams.entries()];
          if (
            entries.filter(([key]) => /^(marketId|selectionId)/i.test(key)).length !== 2 ||
            !/^\d+\.\d+$/.test(url.searchParams.get('marketId') ?? '') ||
            !/^\d+$/.test(url.searchParams.get('selectionId') ?? '')
          )
            continue;
          return {
            sportsbook: 'FANDUEL',
            name: 'FanDuel',
            url: offer.deeplink,
            selectionKeys: legs.map(slipKey),
          };
        } catch {
          /* Invalid provider links cannot be transferred. */
        }
      }
      return null;
    },
  },
];
export const unavailableTransferMessage = (count: number) =>
  count === 1
    ? 'Direct sportsbook transfer is unavailable for this selection. Add this exact line manually in your sportsbook.'
    : 'Direct transfer is unavailable for this parlay. Add these selections manually in your sportsbook.';
export function compatibleSlipTransfers(
  legs: SlipLeg[],
  offers: SlipLeg[],
  integrations = verifiedSlipIntegrations,
) {
  if (!legs.length) return [];
  return integrations.flatMap((adapter) => {
    if (
      !legs.every((leg) =>
        offers.some(
          (m) => m.available && m.sportsbook === adapter.sportsbook && slipKey(m) === slipKey(leg),
        ),
      )
    )
      return [];
    const transfer = adapter.verifyAndBuild(legs, offers);
    if (
      !transfer ||
      transfer.sportsbook !== adapter.sportsbook ||
      transfer.selectionKeys.length !== legs.length ||
      !legs.every((m) => transfer.selectionKeys.includes(slipKey(m)))
    )
      return [];
    try {
      if (new URL(transfer.url).protocol !== 'https:') return [];
    } catch {
      return [];
    }
    return [transfer];
  });
}
