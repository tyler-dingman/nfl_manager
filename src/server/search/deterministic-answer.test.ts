import assert from 'node:assert/strict';
import test from 'node:test';

import type { SearchResult } from '@/features/search/types';
import { buildDeterministicSearchAnswer } from './deterministic-answer';

const result = (id: string, summary: string): SearchResult => ({
  id,
  teamId: 'KC',
  type: 'story',
  title: `Story ${id}`,
  summary,
  url: `/content/${id}`,
  sourceName: 'Down & Distance',
  sourceUrl: null,
  publishedAt: null,
  updatedAt: '2026-09-10T12:00:00.000Z',
  image: null,
  score: 1,
  canonicalStoryId: id,
  metadata: {},
});

test('builds a grounded answer with source markers and at most three records', () => {
  const answer = buildDeterministicSearchAnswer('injury updates', [
    result('1', 'First update.'),
    result('2', 'Second update.'),
    result('3', 'Third update.'),
    result('4', 'Fourth update.'),
  ]);
  assert.match(answer ?? '', /First update\. \[1\]/);
  assert.match(answer ?? '', /Third update\. \[3\]/);
  assert.doesNotMatch(answer ?? '', /Fourth update/);
});

test('removes raw links and hashtag dumps from excerpts', () => {
  const answer = buildDeterministicSearchAnswer('news', [
    result('1', 'Useful update https://example.com #Chiefs #NFL'),
  ]);
  assert.equal(answer?.includes('https://'), false);
  assert.equal(answer?.includes('#Chiefs'), false);
});

test('returns no answer without supported records', () => {
  assert.equal(buildDeterministicSearchAnswer('news', []), undefined);
});
