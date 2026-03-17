import assert from 'node:assert/strict';

import { createSaveState, getProjectedCapSpaceForTeam, getProjectedRosterForTeam, getSaveStateResult } from '@/server/api/store';
import { signFreeAgent } from '@/server/api/players';
import { addTradeAsset, createTrade, proposeTrade } from '@/server/api/trades';

const testFreeAgentSigningUpdatesCapAndTeam = () => {
  const saveId = `test-sign-${Date.now()}`;
  const state = createSaveState(saveId, 'GB');
  const freeAgent = state.freeAgents[0];
  assert.ok(freeAgent, 'expected free agent seed');

  const capBefore = state.header.capSpace;
  const result = signFreeAgent(saveId, freeAgent.id);
  assert.equal(result.ok, true);
  if (!result.ok) return;

  const roster = getProjectedRosterForTeam(state, 'GB');
  assert.ok(roster.some((player) => player.id === freeAgent.id));
  assert.ok(!state.freeAgents.some((player) => player.id === freeAgent.id));
  assert.equal(state.header.capSpace, Number((capBefore - freeAgent.year1CapHit).toFixed(1)));
};

const testTradeUpdatesBothTeamsRostersAndCap = () => {
  const saveId = `test-trade-${Date.now()}`;
  const state = createSaveState(saveId, 'GB');
  const userPlayer = state.roster[0];

  const created = createTrade(saveId, 'DAL');
  assert.equal(created.ok, true);
  if (!created.ok) return;

  const partnerPlayer = created.data.partnerRoster[0];
  assert.ok(partnerPlayer);

  addTradeAsset(created.data.trade.id, { side: 'send', type: 'player', playerId: userPlayer.id }, saveId);
  addTradeAsset(created.data.trade.id, { side: 'receive', type: 'player', playerId: partnerPlayer.id }, saveId);

  const proposed = proposeTrade(created.data.trade.id, saveId);
  assert.equal(proposed.ok, true);
  if (!proposed.ok) return;
  assert.equal(proposed.data.accepted, true);

  const userRoster = getProjectedRosterForTeam(state, 'GB');
  const partnerRoster = getProjectedRosterForTeam(state, 'DAL');
  assert.ok(!userRoster.some((player) => player.id === userPlayer.id));
  assert.ok(userRoster.some((player) => player.id === partnerPlayer.id));
  assert.ok(partnerRoster.some((player) => player.id === userPlayer.id));

  assert.ok(getProjectedCapSpaceForTeam(state, 'GB') !== getProjectedCapSpaceForTeam(state, 'DAL'));
};

const testTradeCapViolationValidation = () => {
  const saveId = `test-trade-cap-${Date.now()}`;
  const state = createSaveState(saveId, 'GB');
  state.teamCaps.GB = 0;
  state.header.capSpace = 0;

  const created = createTrade(saveId, 'DAL');
  assert.equal(created.ok, true);
  if (!created.ok) return;

  const partnerPlayer = created.data.partnerRoster[0];
  addTradeAsset(created.data.trade.id, { side: 'receive', type: 'player', playerId: partnerPlayer.id }, saveId);

  const proposed = proposeTrade(created.data.trade.id, saveId);
  assert.equal(proposed.ok, true);
  if (!proposed.ok) return;

  assert.equal(proposed.data.accepted, false);
  assert.ok(proposed.data.proposal.validationErrors.some((error) => error.code === 'CAP_VIOLATION'));
};

const testValueImbalanceDetected = () => {
  const saveId = `test-trade-value-${Date.now()}`;
  const state = createSaveState(saveId, 'GB');
  const createdAfterSave = createTrade(saveId, 'DAL');
  assert.equal(createdAfterSave.ok, true);
  if (!createdAfterSave.ok) return;

  const userPlayer = state.roster[0];
  const partnerPlayer = createdAfterSave.data.partnerRoster[2];
  addTradeAsset(createdAfterSave.data.trade.id, { side: 'send', type: 'player', playerId: userPlayer.id }, saveId);
  addTradeAsset(createdAfterSave.data.trade.id, { side: 'receive', type: 'player', playerId: partnerPlayer.id }, saveId);

  const proposed = proposeTrade(createdAfterSave.data.trade.id, saveId);
  assert.equal(proposed.ok, true);
  if (!proposed.ok) return;

  assert.equal(proposed.data.tradeBalance.balanced, false);
};

const testReloadPersistsSaveSpecificState = () => {
  const saveId = `test-reload-${Date.now()}`;
  const state = createSaveState(saveId, 'GB');
  const freeAgent = state.freeAgents[0];
  signFreeAgent(saveId, freeAgent.id);

  const stateResult = getSaveStateResult(saveId);
  assert.equal(stateResult.ok, true);
  if (!stateResult.ok) return;

  assert.ok(stateResult.data.transactions.some((tx) => tx.playerId === freeAgent.id && tx.type === 'signing'));
  assert.ok(getProjectedRosterForTeam(stateResult.data, 'GB').some((player) => player.id === freeAgent.id));
};

const testNoDuplicatePlayersAcrossTeams = () => {
  const saveId = `test-dup-${Date.now()}`;
  const state = createSaveState(saveId, 'GB');
  const userPlayer = state.roster[0];

  const created = createTrade(saveId, 'DAL');
  if (!created.ok) throw new Error('unable to create trade');

  const partnerPlayer = created.data.partnerRoster[0];
  addTradeAsset(created.data.trade.id, { side: 'send', type: 'player', playerId: userPlayer.id }, saveId);
  addTradeAsset(created.data.trade.id, { side: 'receive', type: 'player', playerId: partnerPlayer.id }, saveId);
  proposeTrade(created.data.trade.id, saveId);

  const all = [...getProjectedRosterForTeam(state, 'GB'), ...getProjectedRosterForTeam(state, 'DAL')];
  const ids = all.map((player) => player.id);
  assert.equal(new Set(ids).size, ids.length);
};

const run = () => {
  testFreeAgentSigningUpdatesCapAndTeam();
  testTradeUpdatesBothTeamsRostersAndCap();
  testTradeCapViolationValidation();
  testValueImbalanceDetected();
  testReloadPersistsSaveSpecificState();
  testNoDuplicatePlayersAcrossTeams();
  console.log('live projection tests passed');
};

run();
