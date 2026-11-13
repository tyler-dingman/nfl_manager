import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCsv, normalizeScheduleSeasonType } from './importer';

test('parses quoted nflverse-style csv fields without losing commas', () => {
  const rows = parseCsv('player_id,player_display_name,season\n00-1,"Smith, John",2025\n');
  assert.deepEqual(rows, [
    { player_id: '00-1', player_display_name: 'Smith, John', season: '2025' },
  ]);
});

test('all nflverse playoff rounds join POST player statistics instead of being silently dropped', () => {
  const schedule = parseCsv(
    'season,week,game_type\n2025,18,REG\n2025,19,WC\n2025,20,DIV\n2025,21,CON\n2025,22,SB\n',
  );
  assert.deepEqual(
    schedule.map((r) => normalizeScheduleSeasonType(r.game_type)),
    ['REG', 'POST', 'POST', 'POST', 'POST'],
  );
  assert.equal(normalizeScheduleSeasonType('POST'), 'POST');
  assert.equal(normalizeScheduleSeasonType('PRE'), null);
  assert.equal(normalizeScheduleSeasonType(''), null);
});
