import test from 'node:test';
import assert from 'node:assert/strict';
import { archiveSnapshot } from './demo-archive';
import { dailyEntries, pollResult } from './daily';
import { dailySnapshot } from './demo-daily';
test('past Huddle has date-specific identity, closed polls and final results', () => {
  const a = archiveSnapshot('KC', 'Kansas City Chiefs', '2026-09-27');
  assert.equal(a.daily?.status, 'ARCHIVED');
  assert.equal(a.daily?.finalRecord, '2–0');
  assert.equal(a.daily?.summary, 'Week 2 win, Worthy breakout, and what’s next');
  assert.ok(a.polls.every((p) => p.closed));
  assert.equal(pollResult(a.polls[0]).percent, 72);
  const entries = dailyEntries(a.messages, 'Live', true);
  assert.equal(entries[0].kind, 'update');
  assert.equal(dailyEntries(a.messages, 'Chat', true).length, 4);
  assert.deepEqual(
    entries.map((m) => m.at),
    entries.map((m) => m.at).sort(),
  );
  assert.equal(dailySnapshot('KC', 'Kansas City Chiefs').daily?.status, 'ACTIVE');
});
test('archive links retain team/date and unavailable dates do not invent history', () => {
  const other = archiveSnapshot('PHI', 'Philadelphia Eagles', '2026-09-28');
  assert.equal(other.daily?.team, 'PHI');
  assert.equal(other.daily?.date, '2026-09-28');
  assert.ok(!JSON.stringify(other).includes('Worthy'));
  assert.ok(!JSON.stringify(other).includes('Mahomes'));
  const missing = archiveSnapshot('KC', 'Kansas City Chiefs', '1900-01-01');
  assert.equal(missing.daily, undefined);
  assert.equal(missing.messages.length, 0);
  assert.ok(missing.unavailable);
});
