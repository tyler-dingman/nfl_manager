import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { getContrastRatio } from './color-utils';
import { TEAM_BRAND_THEMES } from './team-brand-themes';
import { getFrontOfficeTeamTheme, getTeamThemeTokens } from './team-theme-tokens';

test('Chiefs filled-primary controls use white at WCAG AA contrast', () => {
  const tokens = getTeamThemeTokens('KC');
  assert.equal(tokens.onPrimary, '#ffffff');
  assert.equal(tokens.primaryFill, '#E31837');
  assert.ok(getContrastRatio(tokens.onPrimary, tokens.primaryFill) >= 4.5);
});

test('every NFL team filled-primary token pair meets WCAG AA', () => {
  for (const teamAbbr of Object.keys(TEAM_BRAND_THEMES)) {
    const tokens = getTeamThemeTokens(teamAbbr);
    assert.ok(
      getContrastRatio(tokens.onPrimary, tokens.primaryFill) >= 4.5,
      `${teamAbbr} has an unsafe filled-primary token pair`,
    );
  }
});

test('all 32 Front Office themes provide accessible navigation and interactive pairs', () => {
  assert.equal(Object.keys(TEAM_BRAND_THEMES).length, 32);
  for (const teamAbbr of Object.keys(TEAM_BRAND_THEMES)) {
    const theme = getFrontOfficeTeamTheme(teamAbbr);
    assert.ok(theme.navBackground);
    assert.ok(theme.navForeground);
    assert.ok(theme.interactive);
    assert.ok(theme.interactiveForeground);
    assert.ok(theme.interactiveText);
    assert.ok(
      getContrastRatio(theme.navForeground, theme.navBackground) >= 4.5,
      `${teamAbbr} has unsafe Front Office navigation contrast`,
    );
    assert.ok(
      getContrastRatio(theme.interactiveForeground, theme.interactive) >= 4.5,
      `${teamAbbr} has unsafe Front Office interactive contrast`,
    );
    assert.ok(
      getContrastRatio(theme.interactiveText, '#0E232A') >= 4.5,
      `${teamAbbr} has unsafe Front Office interactive text contrast`,
    );
    assert.ok(
      getContrastRatio(theme.navActiveIndicator, theme.navBackground) >= 3,
      `${teamAbbr} has an invisible Front Office active indicator`,
    );
  }
});

test('Detroit and Kansas City retain team identity with readable Front Office colors', () => {
  const detroit = getFrontOfficeTeamTheme('DET');
  const kansasCity = getFrontOfficeTeamTheme('KC');
  assert.equal(detroit.navBackground, '#091A20');
  assert.equal(detroit.interactive, '#0076B6');
  assert.equal(detroit.navForeground, '#ffffff');
  assert.equal(kansasCity.navBackground, '#091A20');
  assert.equal(kansasCity.interactive, '#E31837');
  assert.equal(getFrontOfficeTeamTheme('CHI').interactive, '#C83803');
  assert.equal(getFrontOfficeTeamTheme('NYJ').navBackground, detroit.navBackground);
  assert.equal(kansasCity.navForeground, '#ffffff');
});

test('the default Down & Distance red fill also uses accessible white', () => {
  const tokens = getTeamThemeTokens();
  assert.equal(tokens.onPrimary, '#ffffff');
  assert.ok(getContrastRatio(tokens.onPrimary, tokens.primaryFill) >= 4.5);
});

test('shared filled-primary contract resists inherited foreground overrides', () => {
  const css = readFileSync('src/app/globals.css', 'utf8');
  assert.match(
    css,
    /\.team-primary-filled[\s\S]*background-color: var\(--team-primary-fill\) !important/,
  );
  assert.match(css, /\.team-primary-filled[\s\S]*color: var\(--color-on-primary\) !important/);
  assert.match(css, /\.team-primary-filled :where\(\*\)[\s\S]*color: inherit !important/);
});

test('known selected states use the shared semantic filled-primary contract', () => {
  const account = readFileSync('src/components/auth/account-screen.tsx', 'utf8');
  const notifications = readFileSync(
    'src/components/notifications/notification-center.tsx',
    'utf8',
  );
  assert.match(account, /section === id \? 'team-primary-filled'/);
  assert.match(notifications, /filter === value \? 'team-primary-filled'/);
  assert.doesNotMatch(account, /team-secondary-on-primary/);
  assert.doesNotMatch(notifications, /team-secondary-on-primary/);
});
