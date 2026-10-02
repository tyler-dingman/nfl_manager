import test from 'node:test';
import assert from 'node:assert/strict';
import { isFrontOfficeNewsNotification } from './front-office-news-notifications';
const event = (headline: string, metadata: Record<string, unknown> = {}, id = 'legacy-event') => ({
  id,
  type: 'league_transaction' as const,
  headline,
  metadata,
});
test('excludes current and legacy results regardless of recap tagging', () => {
  for (const item of [
    event('KC defeats LV 27-20'),
    event('Chiefs beat Raiders'),
    event('49ers defeat Seahawks 21–17'),
    event('KC and LV finish tied'),
    event('Unexpected finish', { newsCategory: 'game_recap' }),
    event('Unexpected finish', {}, 'foe:save:2026:2:game-result:123'),
    event('Final score', { homeScore: 0, awayScore: 7 }),
  ])
    assert.equal(isFrontOfficeNewsNotification(item), false, item.headline);
});
test('retains rumors, transactions and coaching pressure stories', () => {
  for (const headline of [
    'Chiefs exploring a trade for a receiver',
    'Raiders coach on the hot seat after third straight loss',
    'Trade rumors build before the deadline',
    'Kansas City signs a veteran cornerback',
  ]) {
    assert.equal(isFrontOfficeNewsNotification(event(headline)), true, headline);
  }
});
test('messages stay separate from news', () => {
  assert.equal(
    isFrontOfficeNewsNotification(event('Trade offer received', { channel: 'MESSAGE' })),
    false,
  );
});
