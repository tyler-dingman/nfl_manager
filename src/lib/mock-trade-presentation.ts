import {
  evaluateMockPackage,
  mockTradeAssets,
  resolveMockPackage,
  tradeYear,
  type MockTradeOffer,
} from './mock-draft-trades';
import type { DraftSessionDTO } from '@/types/draft';

export function presentMockOffer(session: DraftSessionDTO, offer: MockTradeOffer) {
  const all = mockTradeAssets(session, true);
  const send = offer.send.flatMap((id) => all.find((p) => p.id === id) ?? []);
  const receive = offer.receive.flatMap((id) => all.find((p) => p.id === id) ?? []);
  let valid = offer.status === 'active' && session.status === 'in_progress';
  try {
    resolveMockPackage(session, offer.team, offer.send, offer.receive);
  } catch {
    valid = false;
  }
  if (offer.prospectId && session.prospects.find((p) => p.id === offer.prospectId)?.isDrafted)
    valid = false;
  const earliest = [...send, ...receive]
    .filter((p) => p.year === tradeYear(session))
    .sort((a, b) => (a.overallSlot ?? Infinity) - (b.overallSlot ?? Infinity))[0];
  return {
    offer,
    send,
    receive,
    valid,
    status: offer.status === 'active' && !valid ? 'expired' : offer.status,
    value: evaluateMockPackage(send, receive, tradeYear(session)),
    priority: earliest?.overallSlot ?? Infinity,
    expiration: !valid
      ? 'Expired'
      : earliest
        ? `Until Pick ${earliest.overallSlot} is used or traded`
        : 'While both teams retain these picks',
  };
}
export function orderedMockOffers(session: DraftSessionDTO) {
  return (session.tradeState?.offers ?? [])
    .filter((o) => o.status === 'active' || o.status === 'expired')
    .map((o) => presentMockOffer(session, o))
    .sort(
      (a, b) =>
        Number(b.valid) - Number(a.valid) ||
        a.priority - b.priority ||
        b.offer.createdPick - a.offer.createdPick,
    );
}
