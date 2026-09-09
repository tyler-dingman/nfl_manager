import assert from 'node:assert/strict';
import test from 'node:test';

import {
  inferFrontOfficePath,
  initializeFrontOfficeSimulationPhase,
} from './front-office-onboarding';

test('new and returning unselected saves stay in onboarding', () => {
  assert.equal(
    inferFrontOfficePath({
      selectedPath: null,
      phase: 'resign_cut',
      experienceMode: 'sandbox',
      completedStepCount: 0,
    }),
    null,
  );
});

test('keeps an explicit path and migrates saves with clear existing progress to full', () => {
  for (const selectedPath of ['full', 'free_agency', 'draft'] as const) {
    assert.equal(
      inferFrontOfficePath({
        selectedPath,
        phase: 'free_agency',
        experienceMode: 'sandbox',
        completedStepCount: 1,
      }),
      selectedPath,
    );
  }
  assert.equal(
    inferFrontOfficePath({
      selectedPath: null,
      phase: 'week-6',
      experienceMode: 'full',
      completedStepCount: 2,
    }),
    'full',
  );
});

test('calendar phase initializes a new full save once and never resets progress on reload', () => {
  const initialized = initializeFrontOfficeSimulationPhase('resign_cut', 'week-4');
  assert.equal(initialized, 'week-4');
  const weekFive = `week-${Number(initialized.split('-')[1]) + 1}`;
  const weekSix = `week-${Number(weekFive.split('-')[1]) + 1}`;
  assert.equal(initializeFrontOfficeSimulationPhase(weekSix, 'week-4'), 'week-6');
});
