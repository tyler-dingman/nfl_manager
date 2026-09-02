import assert from 'node:assert/strict';
import test from 'node:test';

import { TEAM_BRAND_THEMES } from './team-brand-themes';
import { contrastRatio, getDeterministicPlayIndex, getHeroPalette } from './playbook-hero';

test('all team hero routes retain readable contrast against the chalkboard', () => {
  for (const team of Object.keys(TEAM_BRAND_THEMES)) {
    const palette = getHeroPalette(team);
    assert.ok(contrastRatio(palette.primaryRoute, palette.background) >= 3, team);
    assert.ok(contrastRatio(palette.secondaryRoute, palette.background) >= 3, team);
    assert.ok(contrastRatio(palette.cta, palette.ctaText) >= 4.5, `${team} CTA`);
  }
});

test('play selection is stable for the same team and date', () => {
  const first = getDeterministicPlayIndex('BAL', '2026-09-01');
  assert.equal(first, getDeterministicPlayIndex('BAL', '2026-09-01'));
  assert.notEqual(first, getDeterministicPlayIndex('BAL', '2026-09-02'));
});

test('the supported teams distribute across the play library', () => {
  const plays = new Set(
    Object.keys(TEAM_BRAND_THEMES).map((team) => getDeterministicPlayIndex(team, '2026-09-01')),
  );
  assert.ok(plays.size >= 5);
});
