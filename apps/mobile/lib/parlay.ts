import { authenticatedFetch } from './auth';
export type ParlayEvent = {
  id: string;
  week: number;
  homeTeamId: string;
  awayTeamId: string;
  kickoffAt: string;
  marketsLocked?: boolean;
};
export type ParlayMarket = import('../../../packages/parlay/research').HomeMarket;
async function get<T>(path: string): Promise<T> {
  const response = await authenticatedFetch(path);
  if (!response.ok) throw new Error('Parlay Lab is temporarily unavailable. Pull down to retry.');
  return response.json() as Promise<T>;
}
export const getParlayEvents = () => get<{ events: ParlayEvent[] }>('/api/parlay-lab/events');
export const getParlayMarkets = (eventId = 'ALL') =>
  get<{ markets: ParlayMarket[] }>(
    `/api/parlay-lab/research?eventId=${encodeURIComponent(eventId)}`,
  );
