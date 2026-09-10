import assert from 'node:assert/strict';
import test from 'node:test';

import { parseTankathonDraftBoard, validateTankathonDraftBoard } from './tankathon-draft';

const row = (rank: number, name: string, position = 'WR', school = 'Ohio State') => `
  <div class="mock-row nfl" data-pos="${position}">
    <div class="mock-row-pick-number">${rank}</div>
    <div class="mock-row-logo"><img src="http://logos.test/${school}.svg" /></div>
    <div class="mock-row-player"><a href="/nfl/players/player-${rank}">
      <div class="mock-row-name">${name}</div>
      <div class="mock-row-school-position">${position} | ${school}</div>
    </a></div>
    <div class="section height-weight"><div>6&#39;4&quot;</div><div>222 <span>lbs</span></div></div>
  </div>`;

test('Tankathon importer parses and orders a valid 2027 board', () => {
  const rows = Array.from({ length: 100 }, (_, index) =>
    row(index + 1, index === 0 ? 'Jeremiah Smith' : `Prospect ${index + 1}`),
  ).join('');
  const parsed = parseTankathonDraftBoard(
    `<h1>2027 NFL Draft Big Board</h1><div>Player Rankings updated <time datetime="2026-09-08T17:33:00-05:00">1 day</time></div><div id="big-board">${rows}</div><div id="big-board-by-school"></div>`,
    '2026-09-09T00:00:00.000Z',
  );
  assert.equal(parsed.draftYear, 2027);
  assert.equal(parsed.prospects.length, 100);
  assert.deepEqual(parsed.prospects[0], {
    sourceRank: 1,
    name: 'Jeremiah Smith',
    position: 'WR',
    school: 'Ohio State',
    height: `6'4"`,
    weight: 222,
    schoolLogo: 'https://logos.test/Ohio State.svg',
    profileUrl: 'https://www.tankathon.com/nfl/players/player-1',
  });
});

test('invalid refresh is rejected so last-known-good data is retained', () => {
  assert.throws(() => validateTankathonDraftBoard(2026, []), /2027/);
  assert.throws(() => validateTankathonDraftBoard(2027, []), /too small/);
});
