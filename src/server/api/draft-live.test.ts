import assert from 'node:assert/strict';
import test from 'node:test';
import { createSaveState } from './store';
import {
  createDraftSession,
  getDraftSession,
  advanceDraftSession,
  applyDraftTrade,
  setDraftSessionPaused,
  pickDraftPlayer,
} from './draft';

test('live draft pauses actual progression, stops at user picks, and removes selected prospects', () => {
  const saveId = `live-draft-test-${Date.now()}`;
  createSaveState(saveId, 'NYJ');
  const { draftSessionId } = createDraftSession('mock', saveId, 1);
  const initial = getDraftSession(draftSessionId, saveId);
  setDraftSessionPaused(draftSessionId, saveId, true);
  assert.throws(() => advanceDraftSession(draftSessionId, saveId), /paused/);
  assert.equal(initial.currentPickIndex, 0);
  setDraftSessionPaused(draftSessionId, saveId, false);
  const advanced = advanceDraftSession(draftSessionId, saveId);
  assert.equal(advanced.currentPickIndex, 1);
  const picked = advanced.picks[0].selectedPlayerId;
  assert.equal(advanced.prospects.find((p) => p.id === picked)?.isDrafted, true);
  assert.equal(advanced.picks[1].ownerTeamAbbr, 'NYJ');
  assert.equal(advanceDraftSession(draftSessionId, saveId).currentPickIndex, 1);
  const player = advanced.prospects.find((p) => !p.isDrafted)!;
  setDraftSessionPaused(draftSessionId, saveId, true);
  const selected = pickDraftPlayer(draftSessionId, player.id, saveId);
  assert.equal(selected.currentPickIndex, 2);
  assert.equal(selected.isPaused, true);
  assert.throws(() => advanceDraftSession(draftSessionId, saveId), /paused/);
  assert.throws(() => advanceDraftSession(draftSessionId, saveId, 'default', true), /paused/);
  assert.throws(
    () => pickDraftPlayer(draftSessionId, selected.prospects.find((p) => !p.isDrafted)!.id, saveId),
    /Not user pick/,
  );
  assert.equal(selected.currentPickIndex, 2);
  assert.equal(selected.picks[1].selectedPlayerId, player.id);
  assert.equal(selected.prospects.find((p) => p.id === player.id)?.isDrafted, true);
});

test('round transitions and completion keep user turns explicit', () => {
  const saveId = `live-rounds-${Date.now()}`;
  const save = createSaveState(saveId, 'NYJ');
  const originalRoster = save.roster.map((p) => p.id);
  const phase = save.header.phase;
  const { draftSessionId } = createDraftSession('mock', saveId, 2);
  let session = getDraftSession(draftSessionId, saveId);
  let reachedSecondRound = false;
  for (let guard = 0; session.status !== 'completed' && guard < 100; guard++) {
    const pick = session.picks[session.currentPickIndex];
    if (pick.round === 2) reachedSecondRound = true;
    if (pick.ownerTeamAbbr === session.userTeamAbbr) {
      const index = session.currentPickIndex;
      assert.equal(advanceDraftSession(draftSessionId, saveId).currentPickIndex, index);
      session = pickDraftPlayer(
        draftSessionId,
        session.prospects.find((p) => !p.isDrafted)!.id,
        saveId,
      );
    } else session = advanceDraftSession(draftSessionId, saveId);
  }
  assert.ok(reachedSecondRound);
  assert.equal(session.status, 'completed');
  const selections = session.picks.flatMap((p) => (p.selectedPlayerId ? [p.selectedPlayerId] : []));
  assert.equal(new Set(selections).size, selections.length);
  assert.deepEqual(
    save.roster.map((p) => p.id),
    originalRoster,
  );
  assert.equal(save.header.phase, phase);
});

test('trades change live pick ownership while preserving a paused draft', () => {
  const saveId = `live-trade-${Date.now()}`;
  createSaveState(saveId, 'NYJ');
  const { draftSessionId } = createDraftSession('mock', saveId, 1);
  const session = getDraftSession(draftSessionId, saveId);
  const currentPick = session.picks[0];
  const userPick = session.picks[1];
  setDraftSessionPaused(draftSessionId, saveId, true);
  const traded = applyDraftTrade(draftSessionId, 'LV', [userPick.id], [currentPick.id], saveId);
  assert.equal(traded.picks[0].ownerTeamAbbr, 'NYJ');
  assert.equal(traded.picks[1].ownerTeamAbbr, 'LV');
  assert.equal(traded.isPaused, true);
  assert.throws(() => advanceDraftSession(draftSessionId, saveId), /paused/);
  setDraftSessionPaused(draftSessionId, saveId, false);
  assert.equal(advanceDraftSession(draftSessionId, saveId).currentPickIndex, 0);
});

test('a stale client snapshot cannot replay a completed user pick', async () => {
  const { POST } = await import('../../app/api/draft/pick/route');
  const saveId = `live-duplicate-${Date.now()}`;
  createSaveState(saveId, 'NYJ');
  const { draftSessionId } = createDraftSession('mock', saveId, 1);
  const snapshot = structuredClone(advanceDraftSession(draftSessionId, saveId));
  const player = snapshot.prospects.find((p) => !p.isDrafted)!;
  const body = { saveId, draftSessionId, playerId: player.id, sessionSnapshot: snapshot };
  const request = () =>
    new Request('http://localhost/api/draft/pick', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  assert.equal((await POST(request())).status, 200);
  assert.equal((await POST(request())).status, 400);
  assert.equal(getDraftSession(draftSessionId, saveId).currentPickIndex, 2);
});

test('simulation targets stop at the user pick, round boundary, or draft completion', async () => {
  const { reachedDraftSimulationTarget } = await import('../../lib/draft-simulation-target');
  const saveId = `sim-targets-${Date.now()}`;
  createSaveState(saveId, 'NYJ');
  const { draftSessionId } = createDraftSession('mock', saveId, 2);
  let session = getDraftSession(draftSessionId, saveId);
  const userTarget = { kind: 'user_pick' as const, round: 1 };
  while (!reachedDraftSimulationTarget(session, userTarget))
    session = advanceDraftSession(draftSessionId, saveId);
  assert.equal(session.currentPickIndex, 1);
  assert.equal(session.picks[1].selectedPlayerId, null);
  const roundTarget = { kind: 'end_round' as const, round: 1 };
  for (let guard = 0; guard < 100 && !reachedDraftSimulationTarget(session, roundTarget); guard++)
    session = advanceDraftSession(draftSessionId, saveId, 'default', true);
  assert.equal(session.picks[session.currentPickIndex].round, 2);
  assert.ok(session.picks[1].selectedPlayerId);
  setDraftSessionPaused(draftSessionId, saveId, true);
  assert.throws(() => advanceDraftSession(draftSessionId, saveId, 'default', true), /paused/);
  setDraftSessionPaused(draftSessionId, saveId, false);
  const draftTarget = { kind: 'end_draft' as const, round: 2 };
  for (let guard = 0; guard < 100 && !reachedDraftSimulationTarget(session, draftTarget); guard++)
    session = advanceDraftSession(draftSessionId, saveId, 'default', true);
  assert.equal(session.status, 'completed');
});

test('skip to next pick advances exactly one CPU or user selection, including boundaries', async () => {
  const { reachedDraftSimulationTarget } = await import('../../lib/draft-simulation-target');
  const saveId = `next-pick-${Date.now()}`;
  createSaveState(saveId, 'NYJ');
  const { draftSessionId } = createDraftSession('mock', saveId, 2);
  let session = getDraftSession(draftSessionId, saveId);
  for (const index of [0, 1, 31, 63]) {
    while (session.currentPickIndex < index)
      session = advanceDraftSession(draftSessionId, saveId, 'default', true);
    const target = {
      kind: 'next_pick' as const,
      round: session.picks[index].round,
      pickIndex: index,
    };
    assert.equal(reachedDraftSimulationTarget(session, target), false);
    const nextId = session.picks[index + 1]?.selectedPlayerId;
    session = advanceDraftSession(draftSessionId, saveId, 'default', true);
    assert.equal(reachedDraftSimulationTarget(session, target), true);
    assert.equal(session.currentPickIndex, index + 1);
    assert.ok(session.picks[index].selectedPlayerId);
    assert.equal(session.picks[index + 1]?.selectedPlayerId, nextId);
    if (session.status === 'in_progress') {
      setDraftSessionPaused(draftSessionId, saveId, true);
      assert.throws(() => advanceDraftSession(draftSessionId, saveId, 'default', true), /paused/);
      setDraftSessionPaused(draftSessionId, saveId, false);
    }
  }
  assert.equal(session.status, 'completed');
});
