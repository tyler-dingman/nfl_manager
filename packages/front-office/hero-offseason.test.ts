import assert from 'node:assert/strict';
import test from 'node:test';
import { createFranchiseSimulation } from '../../src/lib/franchise-simulation';
import { buildHeroCandidates, selectHeroStory, heroStoryKey, type HeroContext } from './hero-story';
import type { DraftSessionDTO } from '../../src/types/draft';
const player = {
  id: 'star',
  name: 'Player One',
  position: 'WR',
  rating: 90,
  image: '/player.png',
  ask: 15,
};
function context(phase: string): HeroContext {
  const state = createFranchiseSimulation({
    seed: 'offseason-A',
    season: 2026,
    teams: [{ abbr: 'KC', overall: 85, conference: 'AFC', division: 'West' }],
    games: [],
  });
  state.phase = phase;
  return {
    state,
    team: 'KC',
    stadium: '/stadium.png',
    players: [player],
    targets: [],
    freeAgents: [player],
    needs: ['WR'],
    offers: [],
    deadlineWeek: 9,
    prospects: [],
    offseason: {
      capSpace: 20,
      pending: [player],
      picks: [24, 56],
      teamName: 'Kansas City Chiefs',
      city: 'Kansas City',
      outcome: 'missed the playoffs',
      champion: false,
      madePlayoffs: false,
      deepRun: false,
    },
  };
}
function draft(): DraftSessionDTO {
  return {
    id: 'real',
    draftYear: 2027,
    mode: 'real',
    rngSeed: 1,
    userTeamAbbr: 'KC',
    maxRounds: 1,
    currentPickIndex: 0,
    isPaused: true,
    status: 'in_progress',
    picks: [
      { id: 'p24', overall: 24, round: 1, ownerTeamAbbr: 'KC', originalTeamAbbr: 'KC' },
      { id: 'p25', overall: 25, round: 1, ownerTeamAbbr: 'LV', originalTeamAbbr: 'LV' },
    ],
    prospects: [
      {
        id: 'prospect',
        firstName: 'Draft',
        lastName: 'Player',
        position: 'WR',
        headshotUrl: '/prospect.png',
        contractYearsRemaining: 0,
        capHit: '0',
        status: 'Prospect',
      },
    ],
  };
}
test('all offseason phases have matching visuals and actionable fallbacks', () => {
  for (const phase of [
    'offseason',
    'resign_cut',
    'scouting_combine',
    'free_agency',
    'free_agency_open',
    'draft',
  ]) {
    const c = context(phase);
    const story = selectHeroStory(c)!;
    assert.ok(story);
    assert.equal(story.phase, phase);
    assert.match(story.href, /^\//);
    assert.equal(heroStoryKey(c.state), `2026:${phase}`);
  }
  assert.equal(selectHeroStory(context('scouting_combine'))?.visualType, 'combine');
});
test('championship is guaranteed, even without a coach/player image', () => {
  const c = context('offseason');
  c.offseason!.champion = true;
  c.players = [];
  assert.equal(selectHeroStory(c)?.headline, 'CHAMPIONS');
  assert.equal(selectHeroStory(c)?.visualType, 'stadium');
});
test('season recap does not invent exceptional players or combine results', () => {
  assert.ok(!buildHeroCandidates(context('offseason')).some((s) => s.templateId === 'season-star'));
  const combine = selectHeroStory(context('scouting_combine'))!;
  assert.doesNotMatch(combine.body, /40-yard|vertical|bench|stock|seconds/);
});
test('re-sign candidates resolve after an actual action and celebration can be acknowledged', () => {
  const c = context('resign_cut');
  assert.ok(buildHeroCandidates(c).some((s) => s.templateId === 'keep-him'));
  c.offseason!.pending = [];
  c.offseason!.action = { id: 'signed-1', type: 're-sign', player, years: 3, total: 45 };
  const success = selectHeroStory(c)!;
  assert.equal(success.headline, "HE'S STAYING HOME");
  assert.equal(success.postActionId, 'signed-1');
  c.state.heroAcknowledgements = ['signed-1'];
  assert.equal(selectHeroStory(c)?.templateId, 'resign-plan');
  assert.ok(!buildHeroCandidates(c).some((s) => s.templateId === 'keep-him'));
});
test('free agency uses available subjects; actual signing temporarily wins', () => {
  const c = context('free_agency_open');
  assert.equal(selectHeroStory(c)?.subjectId, 'star');
  c.freeAgents = [];
  assert.equal(selectHeroStory(c)?.templateId, 'fa-patience');
  c.offseason!.action = { id: 'signing-1', type: 'signing', player, years: 2, total: 30 };
  assert.equal(selectHeroStory(c)?.headline, 'WELCOME TO KANSAS CITY');
  c.offseason!.action = undefined;
  assert.equal(selectHeroStory(c)?.templateId, 'fa-patience');
});
test('draft guarantees on-clock above offers, targets and post-selection', () => {
  const c = context('draft');
  c.offseason!.draft = draft();
  c.prospects = [{ ...player, id: 'prospect', rank: 15, priorRank: 16, low: 10, high: 20 }];
  assert.equal(selectHeroStory(c)?.templateId, 'on-clock');
  c.offseason!.draft!.picks[0].selectedPlayerId = 'prospect';
  c.offseason!.draft!.picks[0].selectedByTeamAbbr = 'KC';
  c.offseason!.draft!.picks[0].grade = 'A';
  c.offseason!.draft!.currentPickIndex = 1;
  assert.ok(
    !buildHeroCandidates(c).some((s) => ['draft-target', 'draft-fall'].includes(s.templateId)),
  );
  assert.equal(selectHeroStory(c)?.templateId, 'draft-welcome');
  assert.match(selectHeroStory(c)!.body, /Selection grade: A/);
});
test('draft celebration acknowledgement clears it and completion cannot show stale targets', () => {
  const c = context('draft');
  const session = draft();
  session.status = 'completed';
  session.currentPickIndex = 2;
  session.picks[0].selectedPlayerId = 'prospect';
  session.picks[0].selectedByTeamAbbr = 'KC';
  c.offseason!.draft = session;
  const story = selectHeroStory(c)!;
  assert.equal(story.templateId, 'draft-welcome');
  assert.doesNotMatch(story.body, /grade/);
  c.state.heroAcknowledgements = [story.postActionId!];
  assert.equal(selectHeroStory(c)?.headline, 'YOUR CLASS IS COMPLETE');
});
test('draft offers must actually exist; incoming assets are described from user perspective', () => {
  const c = context('draft');
  const session = draft();
  session.picks[0].ownerTeamAbbr = 'LV';
  session.picks[1].ownerTeamAbbr = 'KC';
  c.offseason!.draft = session;
  assert.ok(!buildHeroCandidates(c).some((s) => s.templateId === 'draft-offer'));
  session.tradeState = {
    futurePicks: [],
    needs: {},
    history: [],
    evaluatedPicks: [],
    lastOfferPick: 0,
    offers: [
      {
        id: 'offer',
        team: 'LV',
        intent: 'move_up',
        send: ['p25'],
        receive: ['p24'],
        status: 'active',
        reason: '',
        createdPick: 24,
        exchanges: 0,
      },
    ],
  };
  assert.equal(selectHeroStory(c)?.templateId, 'draft-offer');
  assert.match(selectHeroStory(c)!.body, /offered Pick #24 for Pick #25/);
  session.tradeState.offers[0].status = 'declined';
  assert.ok(!buildHeroCandidates(c).some((s) => s.templateId === 'draft-offer'));
});
test('same seed is stable; relevant free-agent shortlist varies across seeds', () => {
  const c = context('free_agency');
  c.freeAgents = [player, { ...player, id: 'other', name: 'Player Two' }];
  assert.deepEqual(selectHeroStory(c), selectHeroStory(structuredClone(c)));
  const subjects = new Set(
    Array.from({ length: 20 }, (_, i) => {
      c.state.seed = `seed-${i}`;
      return selectHeroStory(c)?.subjectId;
    }),
  );
  assert.ok(subjects.size > 1);
});
