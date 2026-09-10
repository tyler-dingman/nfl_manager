import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('Front Office uses the same system sans typography as the public site', () => {
  const css = readFileSync('src/app/globals.css', 'utf8');
  const appRule = css.match(/\.front-office-app \{[\s\S]*?\n  \}/)?.[0] ?? '';
  assert.match(appRule, /ui-sans-serif, system-ui, sans-serif/);
  assert.doesNotMatch(appRule, /font-family: Arial/);
  assert.match(css, /\.front-office-app input,[\s\S]*?font-family: inherit/);
  assert.match(css, /\.front-office-app button,[\s\S]*?font-family: inherit/);
  assert.match(css, /\.fo-team-metrics dd \{[\s\S]*?font-family: inherit/);
  assert.match(css, /\.fo-section-card-heading h2 \{[\s\S]*?font-family: inherit/);
});
