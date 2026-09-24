import assert from 'node:assert/strict';
import test from 'node:test';
import { createSaveState, syncSaveSimulation } from './store';

test('phase and year synchronization preserves roster, contracts, picks, and market decisions', () => {
  const state = createSaveState('phase-sync-fixture', 'NYJ', 2026);
  const roster = structuredClone(state.roster);
  const picks = structuredClone(state.draftPickAssets);
  const capSpace = state.header.capSpace;
  const freeAgents = structuredClone(state.freeAgents);
  for (const phase of ['week-8', 'scouting_combine', 'free_agency', 'free_agency_open', 'draft']) {
    syncSaveSimulation(state.header.id, { phase, season: 2026 });
    assert.equal(state.header.phase, phase);
    assert.equal(state.header.freeAgencyWave, phase === 'free_agency' ? 1 : 2);
  }
  syncSaveSimulation(state.header.id, { phase: 'week-1', season: 2027 });
  assert.equal(state.header.year, 2027);
  assert.deepEqual(state.roster, roster);
  assert.deepEqual(state.draftPickAssets, picks);
  assert.deepEqual(state.freeAgents, freeAgents);
  assert.equal(state.header.capSpace, capSpace);
});
