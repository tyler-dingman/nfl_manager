import assert from 'node:assert/strict';
import test from 'node:test';
import { applySimulation, roomStatusForGame, type GameState } from './index';

const state: GameState = {
  gameId: 'demo',
  status: 'PREGAME',
  homeTeamId: 'KC',
  awayTeamId: 'LV',
  homeScore: 0,
  awayScore: 0,
  quarter: 0,
  clock: '15:00',
  possessionTeamId: null,
  down: null,
  distance: null,
  yardLine: null,
  redZone: false,
  lastPlay: null,
  driveNumber: 0,
  updatedAt: '2026-09-01T00:00:00.000Z',
};

test('kickoff transitions the same game into a live room', () => {
  const result = applySimulation(state, 'KICKOFF');
  assert.equal(result.state.status, 'LIVE');
  assert.equal(roomStatusForGame(result.state.status), 'LIVE');
  assert.equal(result.event?.type, 'GAME_STARTED');
});

test('touchdown updates score and resolves a drive result', () => {
  const result = applySimulation({ ...state, status: 'LIVE', driveNumber: 1 }, 'TOUCHDOWN_HOME');
  assert.equal(result.state.homeScore, 7);
  assert.equal(result.driveResult, 'TOUCHDOWN');
  assert.equal(result.event?.importance, 100);
});

test('final preserves the room as postgame', () => {
  const result = applySimulation({ ...state, status: 'LIVE' }, 'FINAL');
  assert.equal(roomStatusForGame(result.state.status), 'POSTGAME');
});
