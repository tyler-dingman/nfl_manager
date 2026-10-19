import type { SavedPlay } from '../../src/components/parlay-lab/saved-plays';
type Request = (url: string, init?: RequestInit) => Promise<Response>;
export async function accountParlays(request: Request): Promise<SavedPlay[]> {
  const response = await request('/api/user/saved-content');
  if (response.status === 401) return [];
  if (!response.ok) throw Error('Saved account parlays could not be loaded.');
  const body = await response.json();
  return (body.items ?? [])
    .filter(
      (item: any) =>
        item.contentType === 'OTHER' &&
        item.metadata?.kind === 'PARLAY' &&
        Array.isArray(item.metadata?.play?.selections),
    )
    .map((item: any) => item.metadata.play);
}
export async function saveAccountParlay(request: Request, play: SavedPlay) {
  const response = await request('/api/user/saved-content', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contentType: 'OTHER',
      contentId: `parlay:${play.id}`,
      title: `${play.selections.length} Leg Parlay`,
      href: '/parlay-lab/my-plays',
      metadata: { kind: 'PARLAY', play: compactParlaySnapshot(play) },
    }),
  });
  if (response.status === 401) throw Error('Sign in to save this parlay to your account.');
  if (!response.ok) throw Error('Unable to save to your account. Please try again.');
}
export const mergeSavedParlays = (local: SavedPlay[], account: SavedPlay[]) =>
  [...new Map([...account, ...local].map((p) => [p.id, p])).values()].sort((a, b) =>
    (b.createdAt ?? '').localeCompare(a.createdAt ?? ''),
  );

/** Keep saved snapshots useful without uploading full game logs or raw provider payloads. */
export function compactParlaySnapshot(play: SavedPlay): SavedPlay {
  return {
    ...play,
    selections: play.selections.map((leg) => {
      const value = leg as typeof leg & { eventId?: string; lineType?: string };
      const trend = leg.trend as Record<string, unknown> | null | undefined;
      return {
        id: leg.id,
        providerMarketId: leg.providerMarketId,
        providerPlayerId: leg.providerPlayerId,
        providerSelectionId: leg.providerSelectionId,
        providerSelectionKey: leg.providerSelectionKey,
        eventId: value.eventId,
        playerId: leg.playerId,
        playerName: leg.playerName,
        headshotUrl: leg.headshotUrl,
        teamId: leg.teamId,
        marketType: leg.marketType,
        statId: leg.statId,
        normalizedMarketType: leg.normalizedMarketType,
        side: leg.side,
        line: leg.line,
        odds: leg.odds,
        sportsbook: leg.sportsbook,
        period: leg.period,
        isAltLine: leg.isAltLine,
        lineType: value.lineType,
        gradingStatus: leg.gradingStatus,
        actualResult: leg.actualResult,
        gradedAt: leg.gradedAt,
        wasLabFindAtSave: leg.wasLabFindAtSave,
        trend: trend
          ? { trendScore: trend.trendScore, scoreVersion: trend.scoreVersion, last10: trend.last10 }
          : null,
      };
    }),
  };
}
