import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FRONT_OFFICE_ROSTER_ROUTES,
  FRONT_OFFICE_DRAFT_ROUTES,
  FRONT_OFFICE_LEAGUE_ROUTES,
  FRONT_OFFICE_ROUTES,
  isFrontOfficeRouteActive,
} from './front-office-navigation';

test('secondary navigation selects the exact route and view', () => {
  const params = new URLSearchParams('view=resign');
  assert.equal(
    isFrontOfficeRouteActive(FRONT_OFFICE_ROSTER_ROUTES.Contracts, '/roster', params),
    true,
  );
  assert.equal(isFrontOfficeRouteActive(FRONT_OFFICE_ROUTES.Roster, '/roster', params), false);
});

test('primary navigation is limited to Roster, Draft, League, and Settings', () => {
  assert.deepEqual(Object.keys(FRONT_OFFICE_ROUTES), ['Roster', 'Draft', 'League', 'Settings']);
  assert.equal(FRONT_OFFICE_ROUTES.Draft, '/front-office/draft');
  assert.equal(FRONT_OFFICE_ROUTES.League, '/league');
});

test('roster dropdown matches the standardized roster navigation', () => {
  assert.equal(FRONT_OFFICE_ROSTER_ROUTES['Roster Central'], '/roster?view=roster');
  assert.equal(FRONT_OFFICE_ROSTER_ROUTES['Free Agency'], '/free-agents');
  assert.equal(FRONT_OFFICE_ROSTER_ROUTES['Depth Chart'], '/roster?view=depth');
  assert.equal(FRONT_OFFICE_ROSTER_ROUTES.Contracts, '/roster?view=resign');
  assert.equal(FRONT_OFFICE_ROSTER_ROUTES['Trade Hub'], '/front-office/trade-hub?context=roster');
  assert.equal(FRONT_OFFICE_ROSTER_ROUTES['Practice Squad'], '/roster?view=practice-squad');
});

test('draft dropdown exposes the complete Draft Central ecosystem', () => {
  assert.deepEqual(FRONT_OFFICE_DRAFT_ROUTES, {
    'Draft Central': '/front-office/draft',
    'Mock Draft': '/front-office/draft/room?mode=mock',
    'Big Board': '/front-office/draft/big-board',
    'Draft Guide': '/front-office/draft/scouting',
    'Position Rankings': '/front-office/draft/prospects',
    'Team Needs': '/front-office/draft/team-needs',
    'Trade Machine': '/front-office/trade-hub',
    'My Drafts': '/front-office/draft/history',
  });
});

test('league dropdown exposes all league destinations', () => {
  assert.deepEqual(FRONT_OFFICE_LEAGUE_ROUTES, {
    'League Central': '/league',
    News: '/front-office/league/news',
    Standings: '/front-office/league/standings',
    Schedule: '/front-office/league/schedule',
    Transactions: '/league?view=transactions',
  });
});
