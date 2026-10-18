import * as pg from './events-repository-postgres';
import { D1FranchiseEvents } from './d1-events';
import { applicationBackend } from '../persistence/bindings';
export type { NewFrontOfficeEvent } from './events-repository-postgres';
function dispatch<K extends keyof typeof pg>(name: K): (typeof pg)[K] {
  return (async (...args: unknown[]) => {
    if (applicationBackend() === 'postgres') return (pg[name] as Function)(...args);
    const repo = new D1FranchiseEvents();
    return (repo as unknown as Record<string, Function>)[name].apply(repo, args);
  }) as (typeof pg)[K];
}
export const persistFrontOfficeEvents = dispatch('persistFrontOfficeEvents');
export const listFrontOfficeEvents = dispatch('listFrontOfficeEvents');
export const frontOfficeNewsCounts = dispatch('frontOfficeNewsCounts');
export const countUnreadFrontOfficeNews = dispatch('countUnreadFrontOfficeNews');
export const getFrontOfficeEvent = dispatch('getFrontOfficeEvent');
export const surfaceNextFrontOfficeEvent = dispatch('surfaceNextFrontOfficeEvent');
export const markAllFrontOfficeEventsRead = dispatch('markAllFrontOfficeEventsRead');
export const updateFrontOfficeEvent = dispatch('updateFrontOfficeEvent');
export const resolveFrontOfficeEventsForPlayer = dispatch('resolveFrontOfficeEventsForPlayer');
export const persistFrontOfficeTradeOffer = dispatch('persistFrontOfficeTradeOffer');
export const getFrontOfficeTradeOffer = dispatch('getFrontOfficeTradeOffer');
export const updateFrontOfficeTradeOfferStatus = dispatch('updateFrontOfficeTradeOfferStatus');
export const expireFrontOfficeTradeOffers = dispatch('expireFrontOfficeTradeOffers');
