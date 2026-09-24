import assert from 'node:assert/strict';
import test from 'node:test';

import {
  advanceDemoWeek,
  getFrontOfficePhaseActions,
  isDraftWorkflowAvailable,
  frontOfficeLifecycle,
  isOffseasonFreeAgency,
  normalizeFrontOfficePhase,
  phaseDisplayName,
} from './front-office-phase';

test('regular-season action advances one week without confirmation', () => {
  const actions = getFrontOfficePhaseActions('week-6');
  assert.deepEqual(actions.primary, {
    label: 'Continue to Week 7',
    target: 'week-7',
    requiresConfirmation: false,
  });
});

test('Week 1 offers Week 2 first, then Trade Deadline and Playoffs in that order', () => {
  const actions = getFrontOfficePhaseActions('week-1');
  assert.equal(actions.primary.label, 'Continue to Week 2');
  assert.deepEqual(
    actions.jumps.map((action) => action.label),
    ['Continue to Trade Deadline', 'Continue to Playoffs'],
  );
});

test('trade deadline jump disappears after the deadline', () => {
  assert.equal(
    getFrontOfficePhaseActions('week-6').jumps.some((action) =>
      action.label.includes('Trade Deadline'),
    ),
    true,
  );
  assert.equal(
    getFrontOfficePhaseActions('week-10').jumps.some((action) =>
      action.label.includes('Trade Deadline'),
    ),
    false,
  );
});

test('offseason cannot skip its stages', () => {
  assert.equal(getFrontOfficePhaseActions('resign_cut').primary.target, 'free_agency');
  assert.deepEqual(getFrontOfficePhaseActions('scouting_combine').jumps, []);
  assert.equal(getFrontOfficePhaseActions('free_agency').primary.target, 'free_agency_open');
  assert.equal(getFrontOfficePhaseActions('free_agency_open').primary.target, 'draft');
  assert.equal(getFrontOfficePhaseActions('draft').primary.href, '/front-office/draft');
  assert.equal(
    getFrontOfficePhaseActions('draft', { draftCompleted: true }).primary.target,
    'week-1',
  );
});

test('one-week demo advancement updates the week and record together', () => {
  assert.deepEqual(
    advanceDemoWeek({ phase: 'week-1', record: { wins: 0, losses: 0, ties: 0 } }, 'win'),
    { phase: 'week-2', record: { wins: 1, losses: 0, ties: 0 } },
  );
});

test('draft pick controls stay hidden outside the active Draft phase', () => {
  assert.equal(isDraftWorkflowAvailable('week-8'), false);
  assert.equal(isDraftWorkflowAvailable('free_agency'), false);
  assert.equal(isDraftWorkflowAvailable('draft'), true);
});

test('Free Agency controls are exclusive to the two offseason Free Agency phases', () => {
  for (const phase of [
    'week-1',
    'week-8',
    'week-18',
    'wild-card',
    'divisional',
    'conference',
    'super-bowl',
    'scouting_combine',
    'draft',
  ]) {
    assert.equal(isOffseasonFreeAgency(phase), false, phase);
  }
  assert.equal(isOffseasonFreeAgency('free_agency'), true);
  assert.equal(isOffseasonFreeAgency('free_agency_open'), true);
  assert.equal(frontOfficeLifecycle('free_agency').freeAgencyPhase, 'TAMPERING');
  assert.equal(frontOfficeLifecycle('free_agency_open').freeAgencyPhase, 'OPEN_FREE_AGENCY');
  assert.equal(phaseDisplayName('week-7'), 'Season · Week 7');
});

test('legacy phase names and wave saves normalize without creating extra stages', () => {
  assert.equal(normalizeFrontOfficePhase('resign_cut'), 'scouting_combine');
  assert.equal(normalizeFrontOfficePhase('free_agency', 1), 'free_agency');
  assert.equal(normalizeFrontOfficePhase('free_agency', 3), 'free_agency_open');
  assert.equal(normalizeFrontOfficePhase('preseason'), 'week-1');
});
