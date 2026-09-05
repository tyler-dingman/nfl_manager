import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(
  new URL('../../components/trivia/trivia-game.tsx', import.meta.url),
  'utf8',
);

test('drill UI uses the supplied neutral asset kit and runtime team styling', () => {
  assert.match(source, /assets\/4-minute-drill/);
  assert.match(source, /var\(--primary\)/);
  assert.match(source, /team-primary-filled/);
  assert.match(source, /teamLogo/);
  assert.doesNotMatch(source, /chiefs|kansas city/i);
});

test('drill UI includes the required game surfaces and responsive layouts', () => {
  for (const label of [
    'Game clock',
    'Play',
    'Game info',
    'Live standings',
    'Recent plays',
    'Current drive',
  ]) {
    assert.match(source, new RegExp(label, 'i'));
  }
  assert.match(source, /sm:grid-cols/);
  assert.match(source, /lg:grid-cols/);
  assert.match(source, /role="timer"/);
});

test('solo uses the full broadcast board and keeps every supporting panel', () => {
  assert.match(source, /rows\.length === 1/);
  assert.match(source, /min-h-\[260px\]/);
  assert.match(source, /LiveStandings/);
  assert.match(source, /RecentPlays/);
  assert.match(source, /CurrentDrive/);
  assert.doesNotMatch(source, /mode === ['"]FULL['"].*hide/s);
});

test('end zone is the final fixed strip after the complete field track', () => {
  const finalTick = source.indexOf("'10'];");
  const endZone = source.indexOf('data-testid="drill-end-zone"');
  assert.ok(finalTick >= 0);
  assert.ok(endZone > finalTick);
  assert.match(source, /absolute bottom-0 right-0 top-0/);
  assert.match(source, /drill-end-zone/);
});

test('field renders the complete yard sequence above and below the lanes', () => {
  assert.match(source, /data-yard-numbers={position}/);
  assert.match(source, /position="bottom"/);
  assert.match(source, /\['0', '10', '20', '30', '40', '50', '40', '30', '20', '10'\]/);
  assert.match(source, /drill-yard-number/);
});

test('current drive uses a dedicated light panel while recent plays stays dark', () => {
  assert.match(source, /title="Current drive" className="drill-panel-light"/);
  assert.doesNotMatch(source, /title="Recent plays" className="drill-panel-light"/);
});
