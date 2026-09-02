import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_PREFERENCES } from './types';
import { preferencesSchema, profileSchema, teamIdSchema } from './validation';
test('user preference defaults are cross-platform and strongly typed', () => {
  assert.equal(DEFAULT_PREFERENCES.intensity, 'LOCKED_IN');
  assert.equal(DEFAULT_PREFERENCES.showAroundLeague, true);
  assert.equal(DEFAULT_PREFERENCES.smsEnabled, false);
  assert.equal(DEFAULT_PREFERENCES.audioPlaybackSpeed, 1);
});
test('team identifiers normalize consistently', () => assert.equal(teamIdSchema.parse('kc'), 'KC'));
test('preference validation rejects unsupported values', () => {
  assert.equal(preferencesSchema.safeParse({ intensity: 'EXTREME' }).success, false);
  assert.equal(preferencesSchema.safeParse({ audioPlaybackSpeed: 3 }).success, false);
});
test('profile validation accepts minimal data and rejects invalid avatar URLs', () => {
  assert.equal(profileSchema.safeParse({ displayName: 'Tyler' }).success, true);
  assert.equal(profileSchema.safeParse({ avatarUrl: 'not-a-url' }).success, false);
});

test('preferred team is accepted as a typed user preference', () => {
  assert.equal(
    preferencesSchema.safeParse({ preferredTeamId: 'KC', intensity: 'CASUAL' }).success,
    true,
  );
  assert.equal(
    preferencesSchema.safeParse({ preferredTeamId: 'C', intensity: 'CASUAL' }).success,
    false,
  );
});
