import test from 'node:test';
import assert from 'node:assert/strict';

import { createSaveState, getTeamTradeAssets, transferDraftPicksToTeam } from '@/server/api/store';

test('team trade assets include all picks in the four-season trade horizon', () => {
  const state = createSaveState(`test-assets-${Date.now()}`, 'KC');

  const kcAssets = getTeamTradeAssets(state, 'KC');
  const seaAssets = getTeamTradeAssets(state, 'SEA');

  assert.equal(kcAssets.draftPicks.length, 28);
  assert.equal(seaAssets.draftPicks.length, 28);
  assert.deepEqual(
    [...new Set(kcAssets.draftPicks.map((pick) => pick.year))].sort(),
    [2026, 2027, 2028, 2029],
  );
  assert.deepEqual(
    [...new Set(kcAssets.draftPicks.map((pick) => pick.round))].sort((left, right) => left - right),
    [1, 2, 3, 4, 5, 6, 7],
  );
});

test('transferred picks move to the acquiring team asset list', () => {
  const state = createSaveState(`test-pick-transfer-${Date.now()}`, 'KC');
  const originalPick = getTeamTradeAssets(state, 'KC').draftPicks.find(
    (pick) => pick.year === 2026 && pick.round === 2,
  );

  assert.ok(originalPick);
  transferDraftPicksToTeam(state, [originalPick!.id], 'SEA');

  const kcAssets = getTeamTradeAssets(state, 'KC');
  const seaAssets = getTeamTradeAssets(state, 'SEA');

  assert.equal(
    kcAssets.draftPicks.some(
      (pick) => pick.originalTeamAbbr === 'KC' && pick.year === 2026 && pick.round === 2,
    ),
    false,
  );
  assert.equal(
    seaAssets.draftPicks.some(
      (pick) => pick.originalTeamAbbr === 'KC' && pick.year === 2026 && pick.round === 2,
    ),
    true,
  );
});
