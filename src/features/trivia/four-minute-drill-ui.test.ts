import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const source = readFileSync(
  new URL('../../components/trivia/trivia-game.tsx', import.meta.url),
  'utf8',
);
const css = readFileSync(
  new URL('../../components/trivia/trivia-game.module.css', import.meta.url),
  'utf8',
);
const server = readFileSync(
  new URL('../../server/trivia/game-repository.ts', import.meta.url),
  'utf8',
);
test('gameplay removes field presentation and preserves the question feedback phases', () => {
  assert.doesNotMatch(
    source,
    /RaceField|DrillHeader|CurrentDrive|4 Minute Drill|Trending Props|drill-field/,
  );
  for (const text of [
    'Live Leaderboard',
    'Recent Activity',
    'Game Info',
    'Questions Left',
    'Final Leaderboard',
    'role="timer"',
    'Correct answer',
    'Incorrect answer',
  ])
    assert.ok(source.includes(text));
  assert.match(source, /phase === 'REVEAL' \|\| phase === 'STANDINGS'/);
});
test('live standings use a read-only server snapshot and retain the current mobile player', () => {
  assert.match(source, /\?live=1/);
  assert.match(source, /live\?\.standings \?\? game\?\.standings/);
  assert.match(source, /row.userId !== game.currentUserId/);
  const polling = server.slice(server.indexOf('export async function getTriviaLiveState'));
  assert.doesNotMatch(polling, /UPDATE|INSERT/);
  assert.match(polling, /participant_status='JOINED'/);
  assert.match(polling, /trivia_answers/);
});
test('mobile prioritizes the question and summary before standings and activity', () => {
  assert.match(css, /'question'\s+'stats'\s+'leaderboard'\s+'activity'\s+'info'/);
  assert.match(css, /@media \(max-width: 600px\)/);
});
