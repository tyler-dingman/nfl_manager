import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('all The Parlay Bus surfaces use generic branding and Merch header colors', () => {
  for (const name of ['ParlayLabHome', 'ParlayLabPage', 'ParlayLabExplorePage', 'MyPlaysPage']) {
    const source = readFileSync(new URL(`./${name}.tsx`, import.meta.url), 'utf8');
    assert.match(source, /<MainSiteHeader active="parlay-lab" tone="merch" \/>/);
    assert.doesNotMatch(source, /<MainSiteHeader teamAbbr=/);
    assert.doesNotMatch(source, /<TeamThemeProvider team=/);
  }
});
