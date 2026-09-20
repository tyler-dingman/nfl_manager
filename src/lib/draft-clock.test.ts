import assert from 'node:assert/strict';
import test from 'node:test';
import { DraftClock } from './draft-clock';

test('pause freezes fractional time longer than a CPU turn; resume preserves remaining time', () => {
  const clock = new DraftClock(45, 0, true);
  clock.configure(3250, false, 1);
  assert.equal(clock.tick(90000), 41750);
  clock.configure(90000, true, 1);
  assert.equal(clock.tick(91750), 40000);
});
test('speed changes preserve elapsed progress and instant expires without going negative', () => {
  const clock = new DraftClock(45, 0, true);
  clock.configure(5000, true, 6);
  assert.equal(clock.tick(6000), 34000);
  clock.configure(6000, false, 450);
  assert.equal(clock.tick(100000), 34000);
  clock.configure(100000, true, 450);
  assert.equal(clock.tick(100100), 0);
});
