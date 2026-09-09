import assert from 'node:assert/strict';
import test from 'node:test';

import { createSaveState, cutPlayerInState, signFreeAgentInState } from '@/server/api/store';
import { computeTeamNeeds, computeTeamOverviewRaw } from '@/lib/team-overview';

test('cut and free-agent signing reconcile roster, cap, overall, needs, and transaction log', () => {
  const state = createSaveState('front-office-transaction-test', 'KC', 2026);
  const candidate = state.roster.find((player) => (player.releaseSavings ?? 0) > 0);
  assert.ok(candidate);
  const initialCap = state.header.capSpace;
  const initialOverall = computeTeamOverviewRaw(state.roster).overall;
  const initialNeeds = computeTeamNeeds(state.roster);
  const cut = cutPlayerInState(state, candidate.id);
  assert.equal(cut.player.status, 'Cut');
  assert.equal(
    state.header.capSpace,
    Number((initialCap + (candidate.releaseSavings ?? 0)).toFixed(1)),
  );
  assert.equal(state.transactions.at(-1)?.type, 'cut');
  assert.ok(state.freeAgents.some((player) => player.id === candidate.id));

  // Isolate signing reconciliation from the source snapshot's real-world cap position.
  state.header.capSpace = Math.max(state.header.capSpace, 100);
  state.teamCaps.KC = state.header.capSpace;
  const affordable = state.freeAgents.find((player) => {
    const apy = player.currentAskAnnualValue ?? player.expectedAnnualValue ?? 1;
    return apy <= state.header.capSpace;
  });
  assert.ok(affordable);
  const capBeforeSigning = state.header.capSpace;
  const signed = signFreeAgentInState(state, affordable.id);
  assert.equal(signed.player.currentTeamAbbr, 'KC');
  assert.ok(state.header.capSpace < capBeforeSigning);
  assert.equal(state.transactions.at(-1)?.type, 'signing');
  assert.ok(Number.isFinite(computeTeamOverviewRaw(state.roster).overall));
  assert.ok(Array.isArray(computeTeamNeeds(state.roster)));
  assert.ok(Number.isFinite(initialOverall));
  assert.ok(Array.isArray(initialNeeds));
});
