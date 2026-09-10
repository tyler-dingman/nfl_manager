import type { FrontOfficeEvent } from '@/types/front-office';

const TRADE_EVENT_TYPES = new Set<FrontOfficeEvent['type']>(['trade_rumor', 'trade_interest']);

export function getFrontOfficeEventActionUrl(event: FrontOfficeEvent) {
  if (!event.actionUrl) return null;
  if (event.type === 're_sign_ready' && event.playerId) {
    const [pathname, query = ''] = event.actionUrl.split('?');
    const params = new URLSearchParams(query);
    params.set('view', 'resign');
    params.set('playerId', event.playerId);
    params.set('openNegotiation', '1');
    params.set('eventId', event.id);
    return `${pathname}?${params.toString()}`;
  }
  if (!TRADE_EVENT_TYPES.has(event.type) || !event.playerId) return event.actionUrl;

  const [pathname, query = ''] = event.actionUrl.split('?');
  const params = new URLSearchParams(query);
  params.set('playerId', event.playerId);
  if (event.relatedTeamAbbr) params.set('partnerTeamAbbr', event.relatedTeamAbbr);
  params.set('source', 'league-wire');
  params.set('eventId', event.id);

  return `${pathname}?${params.toString()}`;
}

export function getFrontOfficeEventActionLabel(event: FrontOfficeEvent) {
  if (event.type === 'trade_offer') return 'View offer';
  if (event.type === 'trade_rumor' && event.playerId) return 'Explore Trade';
  if (event.type === 'trade_interest') return 'Explore Trade';
  if (event.type === 're_sign_ready') return 'Start Negotiations';
  return 'Open update';
}
