import assert from 'node:assert/strict';
import test from 'node:test';
import { assertLocalOllamaUrl, getContentAiConfig } from './ai-provider';
import { OllamaTopicSummarizer, parseAndValidateOllamaOutput } from './ollama-summarizer';
import type { ContentSource } from './types';

const source: ContentSource = {
  id: 'source-1',
  teamAbbr: 'KC',
  kind: 'reporting',
  publisher: 'Example Sports',
  title: 'Kansas City signs Joe Example',
  url: 'https://example.test/story',
  publishedAt: '2026-09-06T00:00:00Z',
  excerpt: 'Kansas City signed Joe Example on Friday.',
  topicKey: 'signing',
};
const valid = {
  category: 'Roster',
  headline: 'Kansas City signs Joe Example',
  summary: 'Kansas City signed Joe Example.',
  whatHappened: 'Kansas City signed Joe Example on Friday.',
  whyItMatters: null,
  whatsNext: null,
  sourceIds: ['source-1'],
};

test('Ollama config uses explicit local defaults and current env names', () => {
  assert.deepEqual(getContentAiConfig({ CONTENT_AI_PROVIDER: 'ollama' }), {
    provider: 'ollama',
    ollamaBaseUrl: 'http://127.0.0.1:11434',
    ollamaModel: 'qwen3:4b-instruct',
  });
  assert.equal(assertLocalOllamaUrl('http://localhost:11434/path'), 'http://localhost:11434');
  assert.throws(() => assertLocalOllamaUrl('https://ollama.com'), /local loopback/);
});

test('strict JSON parser accepts grounded output', () =>
  assert.deepEqual(parseAndValidateOllamaOutput(JSON.stringify(valid), [source]), valid));
test('strict JSON parser rejects malformed JSON', () =>
  assert.throws(() => parseAndValidateOllamaOutput('{', [source]), SyntaxError));
test('strict JSON parser rejects unknown source IDs', () =>
  assert.throws(
    () =>
      parseAndValidateOllamaOutput(JSON.stringify({ ...valid, sourceIds: ['invented'] }), [source]),
    /unknown source ID/,
  ));
test('strict JSON parser rejects unsupported named content', () =>
  assert.throws(
    () =>
      parseAndValidateOllamaOutput(
        JSON.stringify({ ...valid, summary: 'Patrick Mahomes announced it.' }),
        [source],
      ),
    /Unsupported named fact/,
  ));

test('unavailable Ollama fails clearly without paid fallback', async () => {
  const original = global.fetch;
  global.fetch = async () => {
    throw new Error('offline');
  };
  try {
    await assert.rejects(
      () =>
        new OllamaTopicSummarizer('test', 'http://127.0.0.1:11434').summarize({
          teamAbbr: 'KC',
          teamName: 'Kansas City',
          topicKey: 'signing',
          sources: [source],
        }),
      /No cloud fallback was attempted/,
    );
  } finally {
    global.fetch = original;
  }
});
