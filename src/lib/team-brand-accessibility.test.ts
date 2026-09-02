import assert from 'node:assert/strict';
import test from 'node:test';

import { ensureAccessibleTextColor, getContrastRatio, getReadableTextColor } from './color-utils';
import { DEFAULT_TEAM_BRAND_THEME, TEAM_BRAND_THEMES } from './team-brand-themes';

const themes = { NFL: DEFAULT_TEAM_BRAND_THEME, ...TEAM_BRAND_THEMES };
const surface = '#f7f4ee';

test('all team background tokens receive WCAG AA normal-text foregrounds', () => {
  for (const [team, theme] of Object.entries(themes)) {
    for (const [name, background] of Object.entries(theme)) {
      const foreground = getReadableTextColor(background);
      assert.ok(
        getContrastRatio(foreground, background) >= 4.5,
        `${team} ${name} should have an accessible foreground`,
      );
    }
  }
});

test('all team accent text tokens meet WCAG AA on light surfaces and dark team panels', () => {
  for (const [team, theme] of Object.entries(themes)) {
    const primaryText = ensureAccessibleTextColor(theme.primary, surface);
    const secondaryOnDark = ensureAccessibleTextColor(theme.secondary, theme.dark);
    const secondaryOnPrimary = ensureAccessibleTextColor(theme.secondary, theme.primary);

    assert.ok(getContrastRatio(primaryText, surface) >= 4.5, `${team} primary text on surface`);
    assert.ok(
      getContrastRatio(secondaryOnDark, theme.dark) >= 4.5,
      `${team} secondary text on dark`,
    );
    assert.ok(
      getContrastRatio(secondaryOnPrimary, theme.primary) >= 4.5,
      `${team} secondary text on primary`,
    );
  }
});

test('Buffalo secondary buttons choose white rather than navy text', () => {
  const buffalo = TEAM_BRAND_THEMES.BUF;
  assert.equal(getReadableTextColor(buffalo.secondary), '#ffffff');
  assert.ok(getContrastRatio('#ffffff', buffalo.secondary) >= 4.5);
});
