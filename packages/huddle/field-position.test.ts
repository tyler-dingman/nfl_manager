import test from 'node:test';
import assert from 'node:assert/strict';
import { gameYardLineToFieldPosition, firstDownPosition, fieldPoint } from './field-position';
import { demoSnapshot } from './demo-game';
import { fieldArtwork } from './field-artwork';
import { getHuddleEndZoneAsset, FIELD_TEAMS, FIELD_TOP, FIELD_BOTTOM } from './field-assets';
test('territory mapping works for either possession and direction', () => {
  for (const [side, yard, expected] of [
    ['PHI', 20, 20],
    ['PHI', 42, 42],
    [null, 50, 50],
    ['DAL', 35, 65],
    ['DAL', 10, 90],
  ] as const) {
    assert.equal(
      gameYardLineToFieldPosition({
        possession: 'PHI',
        opponent: 'DAL',
        yardLineTeam: side,
        yardLine: yard,
        direction: 1,
      }),
      expected,
    );
    assert.equal(
      gameYardLineToFieldPosition({
        possession: 'PHI',
        opponent: 'DAL',
        yardLineTeam: side,
        yardLine: yard,
        direction: -1,
      }),
      100 - expected,
    );
  }
  assert.equal(
    gameYardLineToFieldPosition({
      possession: 'DAL',
      opponent: 'PHI',
      yardLineTeam: 'DAL',
      yardLine: 20,
      direction: -1,
    }),
    80,
  );
  assert.equal(fieldPoint(50).x, 744.5);
});
test('all ten resulting states, incremental plays/comments, scoring and reset', () => {
  const positions = [26, 35, 35, 47, 67, 61, 78, 88, 91, 100],
    targets = [30, 45, 45, 57, 77, 77, 88, 78, 94, null];
  positions.forEach((ball, i) => {
    const state = demoSnapshot(i),
      game = state.game!;
    assert.equal(game.ball, ball);
    assert.equal(game.plays.length, i + 1);
    assert.equal(firstDownPosition(game), targets[i]);
    assert.equal(state.messages.length, Number(i >= 3) + Number(i >= 7) + Number(i >= 9));
    assert.equal(game.awayScore, i === 9 ? 17 : 10);
    assert.equal(game.homeScore, 10);
  });
  assert.equal(demoSnapshot(9).game!.down, 'TOUCHDOWN');
  assert.equal(demoSnapshot(0).messages.length, 0);
  assert.equal(demoSnapshot(8).game!.ball, 91);
});
test('replacement PNG mapping and overlay contain no old static artwork', () => {
  const game = demoSnapshot(0).game!;
  assert.equal(FIELD_TEAMS.length, 32);
  for (const team of FIELD_TEAMS)
    for (const side of ['left', 'right'] as const)
      assert.equal(
        getHuddleEndZoneAsset(team, side),
        `/assets/huddle-field-aligned/endzones/${team}/${side}.png`,
      );
  assert.equal(getHuddleEndZoneAsset('XYZ', 'left'), null);
  const xml = fieldArtwork(game, '#00a9ad');
  assert.doesNotMatch(xml, /EAGLES|COWBOYS|<image|<text|turf|gradient/);
  assert.equal((xml.match(/data-field-line="scrimmage"/g) ?? []).length, 1);
  assert.equal(fieldPoint(0, FIELD_TOP).x, 315);
  assert.equal(fieldPoint(0, FIELD_BOTTOM).x, 153);
  assert.equal(fieldPoint(100, FIELD_TOP).x, 1269);
  assert.equal(fieldPoint(100, FIELD_BOTTOM).x, 1428);
  assert.equal(fieldPoint(50, FIELD_BOTTOM).x, 738);
  assert.equal(firstDownPosition({ ...game, down: '1st & Goal' }), null);
});
