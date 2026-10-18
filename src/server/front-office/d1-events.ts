import { TEAM_LIST } from '@/data/teams';
import { isFrontOfficeNewsNotification } from '@/lib/front-office-news-notifications';
import { ownedFranchise } from './d1-context';
import type * as pg from './events-repository-postgres';
import type { FrontOfficeEvent } from '@/types/front-office';
const now = () => new Date().toISOString();
const teamEvent = (event: FrontOfficeEvent, team?: string) =>
  event.teamAbbr === team ||
  event.relatedTeamAbbr === team ||
  (event.metadata.teamIds as string[] | undefined)?.includes(team ?? '') === true;
export class D1FranchiseEvents {
  async persistFrontOfficeEvents(user: string, events: pg.NewFrontOfficeEvent[]) {
    const scope = ownedFranchise(user),
      inserted: FrontOfficeEvent[] = [];
    for (const event of events) {
      ownedFranchise(user, event.saveId);
      if (
        Object.hasOwn(scope.value.events, event.id) ||
        Object.values(scope.value.events).some((e) => e.dedupeKey === event.dedupeKey)
      )
        continue;
      const record = {
        ...structuredClone(event),
        simulationWeek: Math.max(1, event.simulationWeek),
        createdAt: now(),
        readAt: null,
        dismissedAt: null,
        surfacedAt: null,
      };
      Object.defineProperty(scope.value.events, event.id, {
        value: record,
        enumerable: true,
        configurable: true,
        writable: true,
      });
      inserted.push(record);
    }
    return inserted;
  }
  async listFrontOfficeEvents(
    user: string,
    save: string,
    unread = false,
    offset = 0,
    notifications = false,
    options: {
      limit?: number;
      team?: string;
      filter?: string;
      query?: string;
      category?: string;
    } = {},
  ) {
    const scope = ownedFranchise(user, save),
      query =
        TEAM_LIST.find(
          (t) =>
            t.name.toLowerCase().includes((options.query ?? '').toLowerCase()) &&
            (options.query ?? '').length > 2,
        )?.abbr ??
        options.query ??
        '';
    return Object.values(scope.value.events)
      .filter((e) => (!unread || !e.readAt) && (!notifications || isFrontOfficeNewsNotification(e)))
      .filter((e) =>
        [e.headline, e.summary, e.teamAbbr, e.relatedTeamAbbr, e.metadata.newsCategory]
          .join(' ')
          .toLowerCase()
          .includes(query.toLowerCase()),
      )
      .filter(
        (e) =>
          !options.filter ||
          options.filter === 'all' ||
          (options.filter === 'team' && teamEvent(e, options.team)) ||
          (options.filter === 'league' && !teamEvent(e, options.team)) ||
          (options.filter === 'breaking' && String(e.metadata.isBreaking) === 'true'),
      )
      .filter(
        (e) =>
          !options.category ||
          String(e.metadata.newsCategory ?? '').toUpperCase() === options.category,
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
      .slice(
        Math.max(0, offset),
        Math.max(0, offset) + Math.min(60, Math.max(1, options.limit ?? 60)),
      );
  }
  async frontOfficeNewsCounts(user: string, save: string, team: string) {
    const rows = Object.values(ownedFranchise(user, save).value.events).filter(
        isFrontOfficeNewsNotification,
      ),
      categories = new Map<string | null, number>();
    for (const e of rows) {
      const category = typeof e.metadata.newsCategory === 'string' ? e.metadata.newsCategory : null;
      categories.set(category, (categories.get(category) ?? 0) + 1);
    }
    return {
      all: rows.length,
      team: rows.filter((e) => teamEvent(e, team)).length,
      league: rows.filter((e) => !teamEvent(e, team)).length,
      breaking: rows.filter((e) => String(e.metadata.isBreaking) === 'true').length,
      categories: [...categories].map(([category, count]) => ({ category, count })),
    };
  }
  async countUnreadFrontOfficeNews(user: string, save: string) {
    return Object.values(ownedFranchise(user, save).value.events).filter(
      (e) => !e.readAt && isFrontOfficeNewsNotification(e),
    ).length;
  }
  async getFrontOfficeEvent(user: string, id: string) {
    const events = ownedFranchise(user).value.events;
    return Object.hasOwn(events, id) ? events[id] : null;
  }
  async surfaceNextFrontOfficeEvent(user: string, save: string, team?: string) {
    const rank = (e: FrontOfficeEvent) =>
      (e.priority === 'urgent' ? 2 : 0) + (team && teamEvent(e, team) ? 1 : 0);
    const first = Object.values(ownedFranchise(user, save).value.events)
      .filter(
        (e) =>
          !e.surfacedAt &&
          !e.readAt &&
          !e.metadata.resolution &&
          isFrontOfficeNewsNotification(e) &&
          ['urgent', 'high'].includes(e.priority) &&
          (!e.expiresAt || Date.parse(e.expiresAt) > Date.now()),
      )
      .sort((a, b) => rank(b) - rank(a) || a.createdAt.localeCompare(b.createdAt))[0];
    if (first) first.surfacedAt = now();
    return first ?? null;
  }
  async markAllFrontOfficeEventsRead(user: string, save: string) {
    for (const e of Object.values(ownedFranchise(user, save).value.events))
      if (isFrontOfficeNewsNotification(e)) e.readAt ??= now();
  }
  async updateFrontOfficeEvent(user: string, id: string, action: 'read' | 'dismiss') {
    const events = ownedFranchise(user).value.events;
    const event = Object.hasOwn(events, id) ? events[id] : undefined;
    if (!event) return null;
    if (action === 'read') event.readAt ??= now();
    else event.dismissedAt ??= now();
    return event;
  }
  async resolveFrontOfficeEventsForPlayer(
    user: string,
    save: string,
    player: string,
    resolution: 'signed' | 'invalidated',
  ) {
    const result: FrontOfficeEvent[] = [];
    for (const event of Object.values(ownedFranchise(user, save).value.events))
      if (
        event.playerId === player &&
        event.type === 're_sign_ready' &&
        !event.metadata.resolution
      ) {
        event.metadata = { ...event.metadata, resolution, resolvedAt: now() };
        event.actionUrl = null;
        event.readAt ??= now();
        result.push(event);
      }
    return result;
  }
  async persistFrontOfficeTradeOffer(input: Parameters<typeof pg.persistFrontOfficeTradeOffer>[0]) {
    const { value } = ownedFranchise(input.userId, input.saveId);
    if (!Object.hasOwn(value.offers, input.offer.id))
      Object.defineProperty(value.offers, input.offer.id, {
        enumerable: true,
        configurable: true,
        writable: true,
        value: {
          offer: structuredClone(input.offer),
          status: 'pending',
          createdWeek: input.createdWeek,
          expiresWeek: input.expiresWeek,
        },
      });
  }
  async getFrontOfficeTradeOffer(user: string, id: string) {
    const offers = ownedFranchise(user).value.offers;
    return Object.hasOwn(offers, id) ? offers[id] : null;
  }
  async updateFrontOfficeTradeOfferStatus(
    user: string,
    id: string,
    status: Parameters<typeof pg.updateFrontOfficeTradeOfferStatus>[2],
  ) {
    const offers = ownedFranchise(user).value.offers;
    const row = Object.hasOwn(offers, id) ? offers[id] : undefined;
    if (!row || row.status !== 'pending') return null;
    row.status = status;
    return { id, status };
  }
  async expireFrontOfficeTradeOffers(user: string, save: string, week: number) {
    for (const row of Object.values(ownedFranchise(user, save).value.offers))
      if (row.status === 'pending' && row.expiresWeek < week) row.status = 'expired';
  }
}
