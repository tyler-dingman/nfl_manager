import { sportsbookConfig, type Sportsbook } from './sportsbook-transfer';
import type { SlipLeg } from './slip';
export { transferMarkets } from './transfer-markets';
export const transferNotice =
  'Selections may be added to your existing FanDuel bet slip. Review all legs and odds before continuing.';
export const transferFailure =
  'Unable to prepare this FanDuel slip. One or more selections could not be matched exactly. Your Down & Distance parlay has been preserved.';
export function transferEligibility(legs: SlipLeg[], book: Sportsbook = 'fanduel') {
  if (!legs.length || legs.length > 20) return 'Select between 1 and 20 props.';
  if (new Set(legs.map((l) => l.id)).size !== legs.length) return 'Remove duplicate selections.';
  if (
    legs.some(
      (l) =>
        !l.eventId ||
        !l.playerId ||
        !l.playerName ||
        l.sportsbook !== sportsbookConfig[book].stored ||
        !l.available ||
        l.odds == null ||
        !Number.isFinite(l.odds) ||
        Math.abs(l.odds) < 100 ||
        (l.period ?? 'game') !== 'game' ||
        !sportsbookConfig[book].markets.includes(l.marketType) ||
        !['OVER', 'UNDER'].includes(l.side) ||
        l.line == null ||
        !Number.isFinite(l.line),
    )
  )
    return `Use available full-game ${sportsbookConfig[book].name} player props with a supported market, Over/Under direction and exact threshold.`;
  if (!sportsbookConfig[book].sameGame && new Set(legs.map((l) => l.eventId)).size !== legs.length)
    return 'Same-game transfers are not supported yet. Select one prop per NFL game.';
  return null;
}
export type TransferState = {
  id: string;
  status: 'submitting' | 'pending' | 'complete' | 'failed';
  url?: string;
  error?: string;
  expiresAt?: string;
  directionVerified?: false;
};
export type TransferRequest = (url: string, init?: RequestInit) => Promise<Response>;
export function validTransferUrl(value: string, book: Sportsbook = 'fanduel') {
  try {
    const u = new URL(value);
    return (
      u.protocol === 'https:' &&
      (sportsbookConfig[book].hosts as readonly string[]).includes(u.hostname) &&
      !u.username &&
      !u.password &&
      !u.port &&
      sportsbookConfig[book].path.test(u.pathname) &&
      u.searchParams.getAll('utm_campaign').length === 1 &&
      !!u.searchParams.get('utm_campaign')
    );
  } catch {
    return false;
  }
}
export async function transferCall(
  request: TransferRequest,
  body: object,
  signal?: AbortSignal,
): Promise<TransferState> {
  const response = await request('/api/parlay-lab/fanduel-transfer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  const data = await response.json();
  if (!response.ok) throw Error(data.error || transferFailure);
  if (data.url && !validTransferUrl(data.url)) throw Error(transferFailure);
  return data;
}
