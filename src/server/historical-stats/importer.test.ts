import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCsv } from './importer';

test('parses quoted nflverse-style csv fields without losing commas', () => {
  const rows = parseCsv('player_id,player_display_name,season\n00-1,"Smith, John",2025\n');
  assert.deepEqual(rows, [
    { player_id: '00-1', player_display_name: 'Smith, John', season: '2025' },
  ]);
});
