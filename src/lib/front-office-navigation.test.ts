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
  const params = new URLSearchParams('view=cap');
  assert.equal(
    isFrontOfficeRouteActive(FRONT_OFFICE_ROSTER_ROUTES['Cap Space'], '/roster', params),
    true,
  );
  assert.equal(isFrontOfficeRouteActive(FRONT_OFFICE_ROUTES.Roster, '/roster', params), false);
});

test('primary navigation is limited to Roster, Draft, League, and Settings', () => {
  assert.deepEqual(Object.keys(FRONT_OFFICE_ROUTES), ['Roster', 'Draft', 'League', 'Settings']);
  assert.equal(FRONT_OFFICE_ROUTES.Draft, '/front-office/draft');
  assert.equal(FRONT_OFFICE_ROUTES.League, '/front-office/league/news');
});

test('roster dropdown owns team-management destinations without Contracts', () => {
  assert.equal(FRONT_OFFICE_ROSTER_ROUTES['Free Agents'], '/free-agents');
  assert.equal(FRONT_OFFICE_ROSTER_ROUTES['Depth Chart'], '/roster?view=depth');
  assert.equal(FRONT_OFFICE_ROSTER_ROUTES['Cap Space'], '/roster?view=cap');
  assert.equal(FRONT_OFFICE_ROSTER_ROUTES['Trade Hub'], '/front-office/trade-hub');
  assert.equal('Contracts' in FRONT_OFFICE_ROSTER_ROUTES, false);
});

test('draft dropdown exposes the complete Draft Central ecosystem', () => {
  assert.deepEqual(FRONT_OFFICE_DRAFT_ROUTES, {
    'Draft Central': '/front-office/draft',
    Prospects: '/front-office/draft/prospects',
    'My Big Board': '/front-office/draft/big-board',
    'Team Needs': '/front-office/draft/team-needs',
    'Mock Drafts': '/front-office/draft/mock-drafts',
    'Draft History': '/front-office/draft/history',
    'Scouting Reports': '/front-office/draft/scouting',
    'Draft Room': '/front-office/draft/room',
  });
});

test('league dropdown exposes all league destinations', () => {
  assert.deepEqual(FRONT_OFFICE_LEAGUE_ROUTES, {
    News: '/front-office/league/news',
    Standings: '/front-office/league/standings',
    Schedule: '/front-office/league/schedule',
    Transactions: '/league?view=transactions',
    Injuries: '/league?view=injuries',
    'League Leaders': '/league?view=stats',
  });
});
