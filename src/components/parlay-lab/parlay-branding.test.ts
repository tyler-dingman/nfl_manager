import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const home = readFileSync(new URL('./ParlayLabHome.tsx', import.meta.url), 'utf8');
const game = readFileSync(new URL('./ParlayLabPage.tsx', import.meta.url), 'utf8');
const trends = readFileSync(
  new URL('../../app/parlay-lab/trends/page.tsx', import.meta.url),
  'utf8',
);

test('all Parlay Lab surfaces use generic Down & Distance branding', () => {
  for (const source of [home, game]) {
    assert.match(source, /<TeamThemeProvider>/);
    assert.match(source, /<MainSiteHeader active="parlay-lab" \/>/);
    assert.doesNotMatch(source, /<TeamThemeProvider team=/);
    assert.doesNotMatch(source, /<MainSiteHeader teamAbbr=/);
  }
  assert.match(trends, /<MainSiteHeader active="parlay-lab" \/>/);
  assert.doesNotMatch(trends, /teamAbbr=/);
});
