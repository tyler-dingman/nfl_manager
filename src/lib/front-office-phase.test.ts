import assert from 'node:assert/strict';
import test from 'node:test';

import {
  advanceDemoWeek,
  getFrontOfficePhaseActions,
  isDraftWorkflowAvailable,
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

test('large phase jumps require confirmation', () => {
  const jump = getFrontOfficePhaseActions('resign_cut').jumps[0];
  assert.equal(jump.target, 'draft');
  assert.equal(jump.requiresConfirmation, true);
  assert.match(jump.confirmation ?? '', /Skip re-signing and free agency/);
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
