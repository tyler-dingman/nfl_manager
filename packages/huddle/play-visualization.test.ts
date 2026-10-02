import test from 'node:test';
import assert from 'node:assert/strict';
import { demoSnapshot } from './demo-game';
import { latestVisualization, playGeometry } from './play-visualization';
import { fieldPoint } from './field-position';
test('run, pass, incomplete, sack, turnover and touchdown use field coordinates without changing game state', () => {
  for (let i = 0; i < 10; i++) {
    const game = demoSnapshot(i).game!;
    const before = JSON.stringify(game),
      play = latestVisualization(game)!;
    const geometry = playGeometry(play);
    assert.equal(JSON.stringify(game), before);
    assert.ok(geometry.markers.every((m) => Number.isFinite(m.point.x)));
    if (i === 0) {
      assert.equal(geometry.markers.length, 1);
      assert.deepEqual(geometry.markers[0].point, fieldPoint(26));
    }
    if (i === 4) {
      assert.equal(geometry.markers.length, 2);
      assert.match(geometry.path, /Q/);
      assert.equal(play.yards, 20);
    }
    if (i === 2) {
      assert.equal(game.ball, play.startYardLine);
      assert.equal(geometry.indicator, '×');
      assert.equal(geometry.markers.length, 2);
    }
    if (i === 5) assert.ok(play.endYardLine < play.startYardLine);
    if (i === 7) {
      assert.equal(game.possession, 'DAL');
      assert.equal(geometry.indicator, 'INT');
    }
    if (i === 9) {
      assert.ok(geometry.destination.x > fieldPoint(100, 70).x);
      assert.equal(geometry.indicator, 'TD');
    }
  }
});
test('missing player/target data does not invent markers', () => {
  const play = latestVisualization(demoSnapshot(2).game!)!;
  assert.equal(playGeometry({ ...play, targetYardLine: undefined }).markers.length, 1);
  assert.equal(
    playGeometry({ ...play, primaryPlayer: undefined, secondaryPlayer: undefined }).markers.length,
    0,
  );
});
