import assert from 'node:assert/strict';
import test from 'node:test';
import type { NFLScheduleGame } from '@/lib/nfl-calendar';
import { findScheduledWeek } from './sportsbookIngestionService';

const schedule: NFLScheduleGame[] = [
  {
    id: 'week-1-den-kc',
    season: 2026,
    seasonType: 'REG',
    week: 1,
    startsAt: '2026-09-15T00:15:00.000Z',
    awayTeam: 'DEN',
    homeTeam: 'KC',
  },
];

test('derives a missing provider week from the matching scheduled game', () => {
  assert.equal(
    findScheduledWeek(schedule, {
      season: 2026,
      awayTeam: 'DEN',
      homeTeam: 'KC',
      kickoffAt: new Date('2026-09-15T00:15:00.000Z'),
    }),
    1,
  );
});

test('does not assign a week from an unrelated matchup', () => {
  assert.equal(
    findScheduledWeek(schedule, {
      season: 2026,
      awayTeam: 'LV',
      homeTeam: 'KC',
      kickoffAt: new Date('2026-09-15T00:15:00.000Z'),
    }),
    null,
  );
});
