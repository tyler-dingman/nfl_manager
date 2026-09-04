import assert from 'node:assert/strict';
import test from 'node:test';

import { isGameDayActive } from './homepage-game';

const kickoff = '2026-09-07T17:00:00.000Z';

test('keeps the normal hero the day before a game', () => {
  assert.equal(
    isGameDayActive(kickoff, new Date('2026-09-07T04:59:00.000Z'), 'America/Chicago'),
    false,
  );
});

test('activates at 12:01 AM in the relevant local timezone', () => {
  assert.equal(
    isGameDayActive(kickoff, new Date('2026-09-07T05:01:00.000Z'), 'America/Chicago'),
    true,
  );
});

test('remains active on game day morning', () => {
  assert.equal(
    isGameDayActive(kickoff, new Date('2026-09-07T14:00:00.000Z'), 'America/Chicago'),
    true,
  );
});

test('does not activate for the same UTC date in another local calendar day', () => {
  assert.equal(
    isGameDayActive(kickoff, new Date('2026-09-08T05:00:00.000Z'), 'America/Chicago'),
    false,
  );
});
