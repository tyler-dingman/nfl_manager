import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { getContrastRatio } from './color-utils';
import { TEAM_BRAND_THEMES } from './team-brand-themes';
import { getTeamThemeTokens } from './team-theme-tokens';

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
