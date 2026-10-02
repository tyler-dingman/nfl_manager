import type { FrontOfficeEvent } from '../../src/types/front-office';
const types = new Set([
  'welcome_message',
  're_sign_ready',
  'trade_interest',
  'deadline_alert',
  'trade_offer',
]);
export function frontOfficeMessages(events: FrontOfficeEvent[]) {
  return events
    .filter((event) => types.has(event.type) || event.metadata.channel === 'MESSAGE')
    .sort((a, b) => {
      if (a.type === 'welcome_message' && b.type === 'welcome_message')
        return Number(a.metadata.messageOrder ?? 99) - Number(b.metadata.messageOrder ?? 99);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
}
