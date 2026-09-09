import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('global desktop header removes Team Select and passes team context to profile', () => {
  const source = readFileSync('src/components/main-site-header.tsx', 'utf8');
  assert.doesNotMatch(source, /Team Select/);
  assert.match(source, /<LoginButton teamAbbr=\{teamAbbr\}/);
});

test('profile menu exposes the existing team selector as Favorite Team', () => {
  const source = readFileSync('src/components/auth/login-button.tsx', 'utf8');
  assert.match(source, /team-select=1/);
  assert.match(source, /Favorite Team/);
});

test('homepage desktop header has no standalone team-switching pill', () => {
  const source = readFileSync('src/components/down-distance-home.tsx', 'utf8');
  assert.doesNotMatch(source, /activeTeam\.abbr} · Team Select/);
  assert.match(source, /<LoginButton teamAbbr=\{activeTeam\?\.abbr\}/);
});
