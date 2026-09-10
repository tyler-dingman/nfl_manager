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
  assert.doesNotMatch(answer ?? '', /•/);
  assert.doesNotMatch(answer ?? '', /strongest Down & Distance matches/);
});

test('answers a schedule question with the relevant source sentence instead of a result dump', () => {
  const answer = buildDeterministicSearchAnswer('When do the Chiefs play?', [
    result(
      '1',
      'The season is almost here. The Kansas City Chiefs open against the Denver Broncos on Monday Night Football, September 14, 2026, at 7:15 PM CDT.',
    ),
  ]);

  assert.equal(
    answer,
    'The Kansas City Chiefs open against the Denver Broncos on Monday Night Football, September 14, 2026, at 7:15 PM CDT. [1]',
  );
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
