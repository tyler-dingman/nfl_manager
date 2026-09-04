import assert from 'node:assert/strict';
import test from 'node:test';

import { chunkText, contentHash, reciprocalRankFusion } from './core';

test('chunkText overlaps long content and preserves the source text order', () => {
  const text = Array.from({ length: 80 }, (_, index) => `word${index}`).join(' ');
  const chunks = chunkText(text, 120, 20);
  assert.ok(chunks.length > 1);
  assert.match(chunks[0], /^word0 /);
  assert.ok(chunks.every((chunk) => chunk.length <= 120));
});

test('contentHash is stable and changes with content', () => {
  assert.equal(contentHash('same'), contentHash('same'));
  assert.notEqual(contentHash('same'), contentHash('changed'));
});

test('reciprocal rank fusion rewards results found by both retrievers', () => {
  const fused = reciprocalRankFusion([
    ['keyword-only', 'shared'],
    ['shared', 'semantic-only'],
  ]);
  assert.equal(fused[0]?.[0], 'shared');
});
