import { selectDiscoveryMarkets } from './discovery-selection';
import { DEFAULT_DISCOVERY, type DiscoveryPreferences } from './discovery-preferences';
import { decimalOdds } from './betting-value';
import type { HomeMarket } from './research';

/** One best qualifying offer per player. Never fill empty slots with duplicate players. */
export function selectHeroProps(
  markets: HomeMarket[],
  teamAbbr: string,
  events: { id: string; kickoffAt: string }[],
  now = Date.now(),
  preferences: DiscoveryPreferences = DEFAULT_DISCOVERY,
) {
  const upcoming = new Set(events.filter((e) => Date.parse(e.kickoffAt) > now).map((e) => e.id));
  const unique = new Map<string, HomeMarket>();
  for (const m of markets) {
    const score = m.trend?.trendScore;
    if (
      !m.available ||
      m.teamId !== teamAbbr ||
      !m.playerId ||
      !m.playerName ||
      m.line == null ||
      !Number.isFinite(m.line) ||
      score == null ||
      !Number.isFinite(score) ||
      score < 0 ||
      score > 100 ||
      !m.eventId ||
      !upcoming.has(m.eventId)
    )
      continue;
    const key = `${m.eventId}:${m.normalizedKey}`;
    const old = unique.get(key);
    if (!old || (decimalOdds(m.odds) ?? 0) > (decimalOdds(old.odds) ?? 0)) unique.set(key, m);
  }
  const ranked = selectDiscoveryMarkets([...unique.values()], preferences);
  const selected: HomeMarket[] = [];
  const players = new Set<string>();
  for (const m of ranked) {
    if (players.has(m.playerId!)) continue;
    selected.push(m);
    players.add(m.playerId!);
    if (selected.length === 3) break;
  }
  return selected;
}
