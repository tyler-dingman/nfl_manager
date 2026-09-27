import test from 'node:test';
import assert from 'node:assert/strict';
import { rewardTierProgress, activeDayStreak } from './presentation';
test('tier boundaries preserve inclusive ranges and lifetime progression', () => {
  for (const [points, name] of [
    [0, 'Rookie'],
    [100, 'Rookie'],
    [101, 'Starter'],
    [250, 'Starter'],
    [251, 'Veteran'],
    [500, 'Veteran'],
    [501, 'All-Pro'],
    [1000, 'All-Pro'],
    [1001, 'Legend'],
  ] as const) {
    const progress = rewardTierProgress(points);
    assert.equal(progress.current.name, name);
    assert.ok(progress.fraction >= 0 && progress.fraction <= 1);
  }
  assert.equal(rewardTierProgress(101).fraction, 0);
  assert.equal(rewardTierProgress(100).remaining, 1);
  assert.equal(rewardTierProgress(1001).next, null);
});
test('day streak permits yesterday, deduplicates days and stops at gaps', () => {
  assert.equal(
    activeDayStreak(['2026-09-27', '2026-09-26', '2026-09-26', '2026-09-24'], '2026-09-27'),
    2,
  );
  assert.equal(activeDayStreak(['2026-09-26', '2026-09-25'], '2026-09-27'), 2);
  assert.equal(activeDayStreak(['2026-09-25'], '2026-09-27'), 0);
});
