import test from 'node:test';
import assert from 'node:assert/strict';
import { useDraftTradeNotifications as store, unreadDraftOffers } from './trade-notifications';
import type { DraftSessionDTO } from '@/types/draft';
const session = (): DraftSessionDTO =>
  ({
    id: 'notification-test',
    mode: 'mock',
    status: 'in_progress',
    userTeamAbbr: 'CHI',
    draftYear: 2027,
    currentPickIndex: 0,
    prospects: [],
    picks: [
      { id: 'one', round: 1, overall: 1, ownerTeamAbbr: 'CHI', originalTeamAbbr: 'CHI' },
      { id: 'two', round: 1, overall: 2, ownerTeamAbbr: 'ARI', originalTeamAbbr: 'ARI' },
    ],
    tradeState: {
      futurePicks: [],
      needs: { CHI: [], ARI: [] },
      offers: [],
      history: [],
      evaluatedPicks: [],
      lastOfferPick: 0,
    },
  }) as unknown as DraftSessionDTO;

test('unread is independent of active; viewing one resolves only its notification', () => {
  const s = session();
  store.getState().sync(s);
  const next = structuredClone(s);
  next.tradeState!.offers = ['offer-a', 'offer-b'].map((id) => ({
    id,
    team: 'ARI',
    intent: 'move_up',
    send: ['one'],
    receive: ['two'],
    status: 'active',
    reason: 'test',
    createdPick: 0,
    exchanges: 0,
  }));
  assert.deepEqual(store.getState().sync(next), ['offer-a', 'offer-b']);
  assert.equal(unreadDraftOffers(store.getState()), 2);
  assert.ok(store.getState().receivedAt['offer-a']);
  store.setState({ toastId: 'offer-a' });
  store.setState({ toastId: null });
  assert.equal(unreadDraftOffers(store.getState()), 2);
  assert.equal(next.tradeState!.offers[0].status, 'active');
  store.getState().view('offer-a');
  assert.equal(unreadDraftOffers(store.getState()), 1);
  assert.equal(next.tradeState!.offers.filter((o) => o.status === 'active').length, 2);
  assert.equal(store.getState().request?.offerId, 'offer-a');
  assert.deepEqual(store.getState().sync(next), []);
  store.getState().markRead(['offer-b']);
  assert.equal(unreadDraftOffers(store.getState()), 0);
  store.getState().clear(s.id);
  assert.equal(store.getState().session, null);
});
test('expired and resolved offers drop badges and cannot open stale actions', () => {
  const s = session();
  s.tradeState!.offers = [
    {
      id: 'offer',
      team: 'ARI',
      intent: 'move_up',
      send: ['one'],
      receive: ['two'],
      status: 'active',
      reason: 'test',
      createdPick: 0,
      exchanges: 0,
    },
  ];
  store.getState().sync(s);
  store.setState({ toastId: 'offer', drawerOpen: true });
  const next = structuredClone(s);
  next.picks[0].selectedPlayerId = 'player';
  store.getState().sync(next);
  assert.equal(unreadDraftOffers(store.getState()), 0);
  assert.equal(store.getState().toastId, null);
  store.getState().view('offer');
  assert.equal(store.getState().request, null);
  store.getState().sync({ ...next, status: 'completed' });
  assert.equal(store.getState().session, null);
  assert.equal(store.getState().drawerOpen, false);
});
