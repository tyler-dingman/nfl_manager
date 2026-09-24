import assert from 'node:assert/strict';
import test from 'node:test';
import { frontOfficeHomePhase } from './front-office-home-phase';
import {
  getFrontOfficePhaseActions,
  getFranchisePhaseActions,
  getFranchiseNextGame,
} from './front-office-phase';
import { createFranchiseSimulation } from './franchise-simulation';

test('Home changes its hero and destination at every lifecycle boundary', () => {
  const expected = [
    ['week-17', 'season'],
    ['week-18', 'season'],
    ['wild-card', 'playoffs'],
    ['scouting_combine', 'combine'],
    ['free_agency', 'free-agency'],
    ['free_agency_open', 'free-agency'],
    ['draft', 'draft'],
    ['nfl_draft', 'draft'],
    ['week-1', 'season'],
  ];
  for (const [phase, kind] of expected) assert.equal(frontOfficeHomePhase(phase).kind, kind);
  for (const phase of ['scouting_combine', 'free_agency', 'free_agency_open', 'draft']) {
    assert.match(frontOfficeHomePhase(phase).eyebrow, /Offseason/);
    assert.doesNotMatch(frontOfficeHomePhase(phase).title, /Focus|Week 18/);
    assert.notEqual(getFrontOfficePhaseActions(phase).primary.target, 'week-1');
  }
});

test('committed Draft completion is required for a next-season CTA; offseason never exposes an old game', () => {
  const state = createFranchiseSimulation({
    seed: 'home',
    season: 2026,
    teams: [],
    games: [{ id: 'old', week: 18, homeTeam: 'TEN', awayTeam: 'NYJ' }],
  });
  state.phase = 'scouting_combine';
  assert.equal(getFranchiseNextGame(state, 'TEN'), undefined);
  assert.equal(getFranchisePhaseActions(state, 'TEN').primary.target, 'free_agency');
  state.phase = 'draft';
  assert.equal(getFranchisePhaseActions(state, 'TEN').primary.href, '/front-office/draft');
  state.completedDraft = {
    id: 'done',
    mode: 'real',
    status: 'completed',
    draftYear: 2027,
    rngSeed: 1,
    userTeamAbbr: 'TEN',
    maxRounds: 1,
    currentPickIndex: 32,
    isPaused: false,
    picks: [],
    prospects: [],
  };
  assert.equal(getFranchisePhaseActions(state, 'TEN').primary.target, 'week-1');
  state.completedDraft.mode = 'mock';
  assert.equal(getFranchisePhaseActions(state, 'TEN').primary.href, '/front-office/draft');
});
