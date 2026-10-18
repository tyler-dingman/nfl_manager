import { applicationPublicCacheScope } from '../persistence/bindings';
import { progressiveSnapshot } from '@/server/cache/progressive-snapshot';
import { isAnytimeTD } from '../../../packages/parlay/anytime-td';
import { queryPropCatalog } from '../../../packages/parlay/prop-catalog';
import { getLocalEventMarkets, listLocalOddsEvents } from './repository';
import { getTrendingProps } from '@/server/historical-stats/trending-props-service';
import { NFL_LEAGUE_DATA } from '@/server/data/nfl-data';
import type { HomeMarket, OddsEvent } from '../../../packages/parlay/research';
/** One bounded, coalesced server snapshot. Page/filter changes reuse it; no provider calls.
 * Raw stored markets remain authoritative. Scoring is optional enrichment, never eligibility.
 * Uses existing ingestion availability, event locks and 60s public-read freshness rules.
 */
type Snapshot = {
  markets: HomeMarket[];
  events: OddsEvent[];
  progress: { complete: boolean; loadedEvents: number; totalEvents: number };
  pages: Map<string, string>;
  activeKey: string;
};
const getPropCatalog = progressiveSnapshot<Snapshot>(
  async (publish) => {
    const events = ((await listLocalOddsEvents()) as unknown as OddsEvent[]).filter(
      (e) => !e.marketsLocked && Date.parse(e.kickoffAt) > Date.now(),
    );
    const markets: HomeMarket[] = [];
    let loadedEvents = 0;
    const snapshot = (complete: boolean): Snapshot => ({
      markets: [...markets],
      events,
      progress: { complete, loadedEvents, totalEvents: events.length },
      pages: new Map(),
      activeKey: '',
    });
    const players = new Map(NFL_LEAGUE_DATA.players.map((p) => [p.id, p]));
    for (let start = 0; start < events.length; start += start === 0 ? 1 : 3) {
      await Promise.all(
        events.slice(start, start + (start === 0 ? 1 : 3)).map(async (event) => {
          const opponents = {
            [event.homeTeamId]: event.awayTeamId,
            [event.awayTeamId]: event.homeTeamId,
          };
          const [raw, scored] = await Promise.all([
            getLocalEventMarkets(event.id),
            getTrendingProps(event.id, opponents, event.season, event, 'all'),
          ]);
          const enrichment = new Map(scored.map((m) => [`${m.id}|${m.sportsbook}`, m]));
          const rows = (raw as unknown as HomeMarket[])
            .filter((m) => m.playerId && m.marketType !== 'OTHER')
            .map((m) => {
              const player = players.get(m.playerId ?? '');
              return {
                ...enrichment.get(`${m.id}|${m.sportsbook}`),
                ...m,
                eventId: event.id,
                line: m.line == null ? null : Number(m.line),
                odds: m.odds == null ? null : Number(m.odds),
                playerName: m.playerName ?? player?.name ?? null,
                teamId: m.teamId ?? player?.teamAbbr ?? null,
                position: player?.position ?? null,
                headshotUrl: player?.headshotUrl ?? null,
              } as HomeMarket;
            });
          markets.push(...rows);
          loadedEvents++;
          publish(snapshot(false));
        }),
      );
    }
    return snapshot(true);
  },
  { scope: applicationPublicCacheScope },
);

/** Cache serialized pages, not copies of the full enriched catalog. Private snapshot ownership. */
export async function getPropCatalogResponse(query: URLSearchParams) {
  const snapshot = await getPropCatalog();
  // A game crossing kickoff must disappear even while the snapshot refreshes.
  const activeKey = snapshot.events
    .filter((e) => !e.marketsLocked && Date.parse(e.kickoffAt) > Date.now())
    .map((e) => e.id)
    .join('|');
  if (snapshot.activeKey !== activeKey) {
    snapshot.pages.clear();
    snapshot.activeKey = activeKey;
  }
  const normalized = new URLSearchParams(query);
  normalized.sort();
  const key = normalized.toString();
  const cached = snapshot.pages.get(key);
  if (cached !== undefined) return cached;
  const body = JSON.stringify({
    ...queryPropCatalog(snapshot.markets, snapshot.events, query),
    progress: snapshot.progress,
  });
  if (snapshot.pages.size >= 32) snapshot.pages.delete(snapshot.pages.keys().next().value!);
  snapshot.pages.set(key, body);
  return body;
}

/** Home discovery shares the same build instead of rescoring every game separately. */
export async function getCatalogResearch(lineMode: 'standard' | 'alternate' | 'all') {
  const snapshot = await getPropCatalog();
  const active = new Set(
    snapshot.events
      .filter((e) => !e.marketsLocked && Date.parse(e.kickoffAt) > Date.now())
      .map((e) => e.id),
  );
  return {
    progress: snapshot.progress,
    markets: snapshot.markets.filter(
      (m) =>
        active.has(m.eventId ?? '') &&
        m.researchStatus &&
        (lineMode === 'all' ||
          (lineMode === 'standard' && isAnytimeTD(m)) ||
          m.lineType === (lineMode === 'standard' ? 'main' : 'alternate')) &&
        (lineMode !== 'alternate' || (m.odds != null && m.odds >= -1000)),
    ),
  };
}
