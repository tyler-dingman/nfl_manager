import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('all Parlay Lab surfaces use selected team branding', () => {
  for (const name of ['ParlayLabHome', 'ParlayLabPage', 'ParlayLabExplorePage', 'MyPlaysPage']) {
    const source = readFileSync(new URL(`./${name}.tsx`, import.meta.url), 'utf8');
    assert.match(source, /<DashboardShell team=/);
    assert.doesNotMatch(source, /tone="merch"/);
    assert.doesNotMatch(source, /<ParlayLabSecondaryNav/);
  }
});
