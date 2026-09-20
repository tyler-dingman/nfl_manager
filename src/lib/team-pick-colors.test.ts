import assert from 'node:assert/strict';
import test from 'node:test';
import { TEAM_BRAND_THEMES } from './team-brand-themes';
import { getContrastRatio } from './color-utils';
import { getAccessibleTeamPickColor } from './team-theme-tokens';

test('all 32 owner colors support white text at WCAG AA contrast', () => {
  assert.equal(Object.keys(TEAM_BRAND_THEMES).length, 32);
  for (const abbr of Object.keys(TEAM_BRAND_THEMES)) {
    assert.ok(getContrastRatio(getAccessibleTeamPickColor(abbr), '#ffffff') >= 4.5, abbr);
  }
  assert.equal(getAccessibleTeamPickColor('CHI'), TEAM_BRAND_THEMES.CHI.primary);
  assert.equal(getAccessibleTeamPickColor('ARI'), TEAM_BRAND_THEMES.ARI.primary);
  assert.equal(getAccessibleTeamPickColor('missing'), '#00172b');
});
