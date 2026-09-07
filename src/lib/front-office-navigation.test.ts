import assert from 'node:assert/strict';
import test from 'node:test';

import { FRONT_OFFICE_ROUTES, isFrontOfficeRouteActive } from './front-office-navigation';

test('secondary navigation selects the exact route and view', () => {
  const params = new URLSearchParams('view=contracts');
  assert.equal(isFrontOfficeRouteActive(FRONT_OFFICE_ROUTES.Contracts, '/roster', params), true);
  assert.equal(isFrontOfficeRouteActive(FRONT_OFFICE_ROUTES.Roster, '/roster', params), false);
});

test('Free Agency and Draft Board are permanent navigation destinations', () => {
  assert.equal(FRONT_OFFICE_ROUTES['Free Agency'], '/free-agents');
  assert.equal(FRONT_OFFICE_ROUTES['Draft Board'], '/draft/room?mode=mock');
});
