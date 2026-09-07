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

test('Atlanta secondary branding uses Falcons red with accessible white text', () => {
  const atlanta = TEAM_BRAND_THEMES.ATL;
  assert.equal(atlanta.secondary, '#A71930');
  assert.equal(getReadableTextColor(atlanta.secondary), '#ffffff');
  assert.ok(getContrastRatio('#ffffff', atlanta.secondary) >= 4.5);
});

test('Cincinnati secondary branding uses Bengals orange with accessible text', () => {
  const cincinnati = TEAM_BRAND_THEMES.CIN;
  const foreground = getReadableTextColor(cincinnati.secondary);
  assert.equal(cincinnati.secondary, '#FB4F14');
  assert.equal(foreground, '#000000');
  assert.ok(getContrastRatio(foreground, cincinnati.secondary) >= 4.5);
});

test('Denver secondary branding uses Broncos orange with accessible text', () => {
  const denver = TEAM_BRAND_THEMES.DEN;
  const foreground = getReadableTextColor(denver.secondary);
  assert.equal(denver.secondary, '#FB4F14');
  assert.equal(foreground, '#000000');
  assert.ok(getContrastRatio(foreground, denver.secondary) >= 4.5);
});

test('Detroit secondary branding uses Lions blue with accessible text', () => {
  const detroit = TEAM_BRAND_THEMES.DET;
  const foreground = getReadableTextColor(detroit.secondary);
  assert.equal(detroit.secondary, '#0076B6');
  assert.equal(foreground, '#ffffff');
  assert.ok(getContrastRatio(foreground, detroit.secondary) >= 4.5);
});

test('New Orleans secondary branding uses Saints gold with accessible text', () => {
  const newOrleans = TEAM_BRAND_THEMES.NO;
  const foreground = getReadableTextColor(newOrleans.secondary);
  assert.equal(newOrleans.secondary, '#D3BC8D');
  assert.equal(foreground, '#000000');
  assert.ok(getContrastRatio(foreground, newOrleans.secondary) >= 4.5);
});

test('New York Jets secondary branding uses Jets green with accessible text', () => {
  const newYorkJets = TEAM_BRAND_THEMES.NYJ;
  const foreground = getReadableTextColor(newYorkJets.secondary);
  assert.equal(newYorkJets.secondary, '#125740');
  assert.equal(foreground, '#ffffff');
  assert.ok(getContrastRatio(foreground, newYorkJets.secondary) >= 4.5);
});
