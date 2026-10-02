import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeMessages, filterPlays, huddleHref, type Game, type Message } from './index';
import { fieldPosition, normalizeHuddleGame } from '../../src/server/huddle/game';
test('updates deduplicate, preserve chronological order and tombstones with bounded history', () => {
  const a = { id: '1', at: '2026-01-01', body: 'before' } as Message,
    b = { id: '2', at: '2026-01-02' } as Message;
  assert.deepEqual(
    mergeMessages([a, b], [{ ...a, removed: true, body: '' }]).map((m) => [m.id, m.body]),
    [
      ['1', ''],
      ['2', undefined],
    ],
  );
  assert.equal(mergeMessages([a], [b], 1)[0].id, '2');
});
test('play filters use drive IDs, not presumed quarter or text', () => {
  const g = {
    driveId: 'b',
    plays: [
      { id: '1', driveId: 'a', sequence: 1, scoring: true, key: true },
      { id: '2', driveId: 'b', sequence: 2, scoring: false, key: false },
    ],
  } as Game;
  assert.equal(filterPlays(g, 'Current Drive')[0].id, '2');
  assert.equal(filterPlays(g, 'Scoring')[0].id, '1');
  assert.equal(filterPlays(g, 'Key Plays').length, 1);
});
test('field orientation requires explicit team/yard context', () => {
  const g = { home: 'DAL', away: 'PHI', possession: 'PHI', location: 'PHI 42', ball: null } as Game;
  assert.equal(fieldPosition(g).ball, 42);
  assert.equal(fieldPosition({ ...g, location: 'DAL 20' }).ball, 80);
  assert.equal(fieldPosition({ ...g, location: 'UNKNOWN' }).ball, null);
});
test('provider adapter does not invent plays or missing scores', () => {
  const payload = {
    header: {
      id: '1',
      competitions: [
        {
          competitors: [
            { homeAway: 'home', team: { abbreviation: 'DAL' } },
            { homeAway: 'away', team: { abbreviation: 'PHI' } },
          ],
          status: { type: { state: 'pre' } },
        },
      ],
    },
  };
  const game = normalizeHuddleGame(payload)!;
  assert.equal(game.status, 'pregame');
  assert.equal(game.homeScore, null);
  assert.equal(game.ball, null);
  assert.deepEqual(game.plays, []);
});
test('deep links retain play and discussion context', () => {
  assert.equal(
    huddleHref('PHI', { discussion: 'story', play: '123' }),
    '/huddle?team=PHI&discussion=story&play=123',
  );
});
