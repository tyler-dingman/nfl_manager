import test from 'node:test';
import assert from 'node:assert/strict';
import { createSaveState, getTeamTradeAssets, transferDraftPicksToTeam } from './store';
import { addTradeAsset, analyzeTrade, createTrade, proposeTrade } from './trades';
function setup() {
  const id = `machine-${crypto.randomUUID()}`;
  const state = createSaveState(id, 'KC');
  state.header.capSpace = 1000;
  state.teamCaps.KC = 1000;
  state.teamCaps.SEA = 1000;
  const user = getTeamTradeAssets(state, 'KC');
  const partner = getTeamTradeAssets(state, 'SEA');
  const created = createTrade(id, 'SEA');
  assert(created.ok);
  return { id, state, user, partner, trade: created.data.trade };
}
test('accepted Trade Machine trades transfer players and picks once and update cap snapshots', () => {
  const { id, state, user, partner, trade } = setup();
  addTradeAsset(trade.id, { side: 'send', type: 'player', playerId: user.players[0].id }, id);
  addTradeAsset(trade.id, { side: 'receive', type: 'player', playerId: partner.players[0].id }, id);
  for (const pick of user.draftPicks)
    addTradeAsset(trade.id, { side: 'send', type: 'pick', pickId: pick.id }, id);
  const receivedPick = partner.draftPicks.at(-1)!;
  addTradeAsset(trade.id, { side: 'receive', type: 'pick', pickId: receivedPick.id }, id);
  const preview = analyzeTrade(trade.id, id);
  assert(preview.ok);
  assert(preview.data.likelyAccepted);
  const result = proposeTrade(trade.id, id);
  assert(result.ok);
  assert(result.data.accepted);
  assert(state.roster.some((p) => p.id === partner.players[0].id && p.teamAbbr === 'KC'));
  assert(!state.roster.some((p) => p.id === user.players[0].id));
  assert(state.teamRosters.SEA.some((p) => p.id === user.players[0].id && p.teamAbbr === 'SEA'));
  assert(
    getTeamTradeAssets(state, 'KC').draftPicks.some(
      (p) =>
        p.year === receivedPick.year &&
        p.round === receivedPick.round &&
        p.originalTeamAbbr === receivedPick.originalTeamAbbr,
    ),
  );
  assert(
    getTeamTradeAssets(state, 'SEA').draftPicks.some(
      (p) =>
        p.year === user.draftPicks[0].year &&
        p.round === user.draftPicks[0].round &&
        p.originalTeamAbbr === user.draftPicks[0].originalTeamAbbr,
    ),
  );
  assert.equal(state.header.capSpace, result.data.simulation.teams.sending.resultingCapSpace);
  const transactions = state.transactions.length;
  assert.throws(() => proposeTrade(trade.id, id), /Trade not found/);
  assert.equal(state.transactions.length, transactions);
});
test('underpaying is rejected and stale pick ownership blocks execution', () => {
  const { id, state, user, partner, trade } = setup();
  const outgoing = user.draftPicks.at(-1)!;
  addTradeAsset(trade.id, { side: 'send', type: 'pick', pickId: outgoing.id }, id);
  addTradeAsset(trade.id, { side: 'receive', type: 'pick', pickId: partner.draftPicks[0].id }, id);
  const result = proposeTrade(trade.id, id);
  assert(result.ok);
  assert.equal(result.data.accepted, false);
  assert.equal(state.transactions.length, 0);
  transferDraftPicksToTeam(state, [outgoing.id], 'DEN');
  assert.throws(() => proposeTrade(trade.id, id), /no longer owned/);
});
