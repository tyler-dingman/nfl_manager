import { getNFLRegularSeasonSchedule } from '@/server/front-office/calendar';
import type { NFLScheduleGame } from '@/lib/nfl-calendar';
import { SportsGameOddsClient, type SportsGameOddsEvent } from '@/server/providers/sportsGameOdds';
import {
  normalizeEventMarkets,
  resolvePlayer,
  resolveTeamAbbr,
  teamProviderId,
} from './normalization';
import {
  listLocalOddsEvents,
  lockStartedOddsEvents,
  mark24HourRefresh,
  markFinalSnapshot,
  upsertMarket,
  upsertOddsEvent,
  upsertPlayerMapping,
  upsertTeamMapping,
} from './repository';

export type ImportSummary = {
  eventsImported: number;
  marketsImported: number;
  pricesBySportsbook: Record<string, number>;
  altLines: number;
  deeplinks: number;
  unmappedPlayers: string[];
  unmappedMarkets: Array<{
    providerEventId: string;
    providerMarketId: string;
    providerMarketName: string;
    statId: string;
    entityId: string;
    period: string;
    side: string;
    line: number | null;
    normalizationStatus: string;
  }>;
};
const emptySummary = (): ImportSummary => ({
  eventsImported: 0,
  marketsImported: 0,
  pricesBySportsbook: {},
  altLines: 0,
  deeplinks: 0,
  unmappedPlayers: [],
  unmappedMarkets: [],
});
const get = (value: unknown, key: string) =>
  value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined;
const dateValue = (event: SportsGameOddsEvent) =>
  get(event.status, 'startsAt') ??
  get(event.status, 'startTime') ??
  event.startsAt ??
  event.startTime;
const intValue = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export function findScheduledWeek(
  schedule: NFLScheduleGame[],
  event: { season: number; homeTeam: string; awayTeam: string; kickoffAt: Date },
) {
  const MAX_KICKOFF_DIFFERENCE_MS = 36 * 60 * 60 * 1000;
  const match = schedule
    .filter(
      (game) =>
        game.season === event.season &&
        game.seasonType === 'REG' &&
        game.homeTeam === event.homeTeam &&
        game.awayTeam === event.awayTeam,
    )
    .map((game) => ({
      game,
      difference: Math.abs(new Date(game.startsAt).getTime() - event.kickoffAt.getTime()),
    }))
    .filter(({ difference }) => Number.isFinite(difference))
    .sort((a, b) => a.difference - b.difference)[0];

  return match && match.difference <= MAX_KICKOFF_DIFFERENCE_MS ? match.game.week : null;
}

export class SportsbookIngestionService {
  constructor(
    private readonly client = new SportsGameOddsClient(),
    private readonly now = () => new Date(),
  ) {}

  async importNflWeek(season: number, week: number) {
    const schedule = (await getNFLRegularSeasonSchedule(season)).filter(
      (game) => game.seasonType === 'REG' && game.week === week,
    );
    if (!schedule.length) throw new Error('No NFL schedule was found for that week.');
    const starts = schedule
      .map((game) => new Date(game.startsAt).getTime())
      .filter(Number.isFinite);
    const after = new Date(Math.min(...starts) - 12 * 60 * 60 * 1000).toISOString();
    const before = new Date(Math.max(...starts) + 12 * 60 * 60 * 1000).toISOString();
    const events = await this.client.getNflEvents({ startsAfter: after, startsBefore: before });
    return this.importEvents(events, season, week);
  }

  async importEvent(providerEventId: string) {
    const existing = (
      (await listLocalOddsEvents()) as unknown as Array<{
        providerEventId: string;
        season: number;
        week: number;
      }>
    ).find((event) => event.providerEventId === providerEventId);
    const events = await this.client.getEvent(providerEventId);
    return this.importEvents(events, existing?.season, existing?.week);
  }

  private async importEvents(
    events: SportsGameOddsEvent[],
    forcedSeason?: number,
    forcedWeek?: number,
  ) {
    const summary = emptySummary();
    for (const event of events) {
      try {
        const kickoffAt = new Date(String(dateValue(event) ?? ''));
        if (!Number.isFinite(kickoffAt.getTime())) {
          console.warn('[sportsbookIngestion] missing kickoff', event.eventID);
          continue;
        }
        if (kickoffAt <= this.now() || get(event.status, 'started') === true) {
          console.info('[sportsbookIngestion] skipped started event', event.eventID);
          continue;
        }
        const homeTeam = resolveTeamAbbr(event.teams?.home);
        const awayTeam = resolveTeamAbbr(event.teams?.away);
        if (!homeTeam || !awayTeam) {
          console.warn('[sportsbookIngestion] unmapped teams', event.eventID);
          continue;
        }
        await upsertTeamMapping(teamProviderId(event.teams?.home), homeTeam);
        await upsertTeamMapping(teamProviderId(event.teams?.away), awayTeam);
        for (const providerPlayerId of Object.keys(event.players ?? {})) {
          const player = resolvePlayer(event, providerPlayerId);
          if (player) await upsertPlayerMapping(providerPlayerId, player.id, player.name);
        }
        const season =
          forcedSeason ??
          intValue(event.season ?? get(event.info, 'season'), kickoffAt.getUTCFullYear());
        const providerWeek = intValue(event.week ?? get(event.info, 'week'), 0);
        const week =
          forcedWeek ??
          (providerWeek > 0
            ? providerWeek
            : findScheduledWeek(await getNFLRegularSeasonSchedule(season), {
                season,
                homeTeam,
                awayTeam,
                kickoffAt,
              }));
        if (!week) {
          throw new Error(
            `NFL week is missing and no schedule match was found for ${awayTeam} at ${homeTeam}.`,
          );
        }
        const stored = await upsertOddsEvent({
          providerEventId: event.eventID,
          season,
          week,
          homeTeamId: homeTeam,
          awayTeamId: awayTeam,
          kickoffAt,
          status: 'scheduled',
        });
        if (stored.marketsLocked) continue;
        const normalized = normalizeEventMarkets(event);
        for (const market of normalized.markets) {
          await upsertMarket(stored.id, event.eventID, market);
          summary.marketsImported += 1;
          summary.altLines += Number(market.isAltLine);
          for (const price of market.prices) {
            summary.pricesBySportsbook[price.sportsbook] =
              (summary.pricesBySportsbook[price.sportsbook] ?? 0) + 1;
            summary.deeplinks += Number(Boolean(price.deeplink));
          }
          if (market.normalizationStatus !== 'KNOWN')
            summary.unmappedMarkets.push({
              providerEventId: event.eventID,
              providerMarketId: market.providerMarketId,
              providerMarketName: market.providerMarketName ?? '',
              statId: market.statId,
              entityId: market.entityId,
              period: market.period,
              side: market.side,
              line: market.line,
              normalizationStatus: market.normalizationStatus,
            });
        }
        summary.eventsImported += 1;
        summary.unmappedPlayers.push(...normalized.unmappedPlayers);
        if (kickoffAt.getTime() - this.now().getTime() <= 90 * 60 * 1000)
          await markFinalSnapshot(stored.id);
        console.info('[sportsbookIngestion] imported', event.eventID, normalized.markets.length);
      } catch (error) {
        console.error(
          '[sportsbookIngestion] event failed',
          event.eventID,
          error instanceof Error ? error.message : error,
        );
      }
    }
    summary.unmappedPlayers = [...new Set(summary.unmappedPlayers)];
    return summary;
  }

  async refreshUpcomingEvents() {
    const events = (await listLocalOddsEvents()) as unknown as Array<{
      id: string;
      providerEventId: string;
      kickoffAt: Date;
      marketsLocked: boolean;
      finalSnapshotAt: Date | null;
      refreshed24hAt: Date | null;
    }>;
    const summaries: ImportSummary[] = [];
    for (const event of events) {
      const until = new Date(event.kickoffAt).getTime() - this.now().getTime();
      if (event.marketsLocked || event.finalSnapshotAt || until <= 0 || until > 7 * 86400000)
        continue;
      const finalWindow = until <= 90 * 60 * 1000;
      const dailyWindow = until <= 24 * 60 * 60 * 1000;
      if (!finalWindow && (!dailyWindow || event.refreshed24hAt)) continue;
      summaries.push(await this.importEvent(event.providerEventId));
      if (finalWindow) await markFinalSnapshot(event.id);
      else await mark24HourRefresh(event.id);
    }
    return summaries;
  }

  async finalizePregameSnapshot(eventId: string) {
    await markFinalSnapshot(eventId);
  }
  async lockStartedEvents() {
    return lockStartedOddsEvents(this.now());
  }
}
