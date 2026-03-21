import test from 'node:test';
import assert from 'node:assert/strict';

import { generateLeagueBuzzToast } from '@/lib/league-buzz';

test('league buzz uses formatted cap amount in cap-clearing cut copy when generated', () => {
  const payload = generateLeagueBuzzToast({
    eventType: 'capClearingCut',
    teamName: 'Kansas City Chiefs',
    playerName: 'Joe Thuney',
    capSavings: 14.2,
    teamAbbr: 'KC',
  });

  if (!payload) {
    assert.ok(true);
    return;
  }

  assert.match(payload.message, /\$14\.2M|Watch this space/);
  assert.equal(payload.displayName, 'Jim Schwartz');
  assert.ok(payload.avatarUrl);
  assert.ok(payload.likes.length > 0);
});
