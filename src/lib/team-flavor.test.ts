import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getRandomTeamPhrase,
  getTeamFlavor,
  getTeamFlavorDataset,
  getTeamReactionLine,
} from '@/lib/team-flavor';

test('team flavor dataset covers all 32 teams', () => {
  assert.equal(Object.keys(getTeamFlavorDataset()).length, 32);
});

test('team flavor falls back safely for unknown teams', () => {
  const flavor = getTeamFlavor('???');
  assert.equal(flavor.teamAbbr, 'NFL');
  assert.ok(flavor.fanPhrases.length > 0);
});

test('seeded team phrases are deterministic', () => {
  const first = getRandomTeamPhrase('KC', 'fanPhrases', { seed: 'offer-1' });
  const second = getRandomTeamPhrase('KC', 'fanPhrases', { seed: 'offer-1' });
  assert.equal(first, second);
});

test('team reaction lines support multiple tones', () => {
  const positive = getTeamReactionLine('MIN', 'positive', { seed: 'draft' });
  const celebratory = getTeamReactionLine('MIN', 'celebratory', { seed: 'draft' });
  assert.notEqual(positive, '');
  assert.notEqual(celebratory, '');
});
