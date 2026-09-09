import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const page = readFileSync('src/app/experience/page.tsx', 'utf8');
const migration = readFileSync('db/migrations/031_front_office_save_state.sql', 'utf8');

test('path onboarding is save-scoped, persisted, and hidden after selection', () => {
  assert.match(page, /dnd-front-office-path:\$\{saveId\}/);
  assert.match(page, /\/api\/front-office\/state/);
  assert.match(page, /selectedPath: selectedMode/);
  assert.match(page, /shouldShowFrontOfficeOnboarding\(savedPath\)/);
  assert.match(page, /return \(\s*<FrontOfficePathGate/);
  assert.match(migration, /PRIMARY KEY \(user_id, save_id\)/);
  assert.match(migration, /'full', 'free_agency', 'draft'/);
});

test('new Full Experience initializes from the calendar without resetting progressed saves', () => {
  assert.match(page, /selectedMode === 'full' && phase === 'resign_cut'/);
  assert.match(page, /\/api\/front-office\/calendar/);
  assert.match(page, /simulationPhase: initialPhase/);
});
