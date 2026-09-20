import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import test from 'node:test';
import headshots from '@/server/data/draft-headshots-2027.json';
import { DRAFT_PROSPECTS_2027 } from '@/server/data/draft-prospects';
import { getDraftHeadshot } from './draft-headshots';

test('all 60 imported headshots exist, are distinct PNGs, and match the active board', () => {
  assert.equal(headshots.length, 60);
  assert.equal(new Set(headshots.map((entry) => entry.sha256)).size, 60);
  for (const entry of headshots) {
    const bytes = readFileSync(`public${entry.localPath}`);
    assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
    assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256);
    const prospect = DRAFT_PROSPECTS_2027.find((p) => p.name === entry.name);
    assert.equal(prospect?.headshotUrl, entry.localPath, entry.name);
  }
});

test('headshot lookup tolerates punctuation without fuzzy player matching', () => {
  assert.equal(getDraftHeadshot('K.J. Bolden')?.name, 'KJ Bolden');
  assert.equal(getDraftHeadshot('Not A Prospect'), undefined);
});
