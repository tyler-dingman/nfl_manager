import assert from 'node:assert/strict';
import test from 'node:test';
import { assertLocalOllamaUrl, getContentAiConfig } from './ai-provider';
import {
  OllamaTopicSummarizer,
  assertNoUnsupportedTransformations,
  assertOriginalWriting,
  ollamaOutputSchema,
  parseAndValidateOllamaOutput,
} from './ollama-summarizer';
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
  headline: 'Joe Example joins Kansas City',
  summary: 'The club added Joe Example to its roster.',
  whatHappened: 'Joe Example signed with Kansas City on Friday.',
  whyItMatters: null,
  whatsNext: null,
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

test('factual validation rejects certainty escalation and invented roles', () => {
  assert.throws(
    () =>
      assertNoUnsupportedTransformations({ ...valid, summary: 'Kansas City finalized the move.' }, [
        { ...source, title: 'Kansas City agrees to terms with Joe Example' },
      ]),
    /escalated to a finalized action/,
  );
  assert.throws(
    () =>
      assertNoUnsupportedTransformations(
        { ...valid, summary: 'Coach Joe Example discussed the move.' },
        [source],
      ),
    /unsupported role attribution/,
  );
  assert.throws(
    () =>
      assertNoUnsupportedTransformations(
        { ...valid, summary: 'The move marked the final step for the season squad.' },
        [source],
      ),
    /unsupported context/,
  );
});

test('strict JSON parser accepts grounded output', () =>
  assert.deepEqual(parseAndValidateOllamaOutput(JSON.stringify(valid), [source]), {
    ...valid,
    sourceIds: ['source-1'],
  }));
test('strict JSON parser rejects malformed JSON', () =>
  assert.throws(() => parseAndValidateOllamaOutput('{', [source]), SyntaxError));
test('Ollama schema excludes internal source IDs and application attaches them deterministically', () => {
  assert.equal('sourceIds' in ollamaOutputSchema.properties, false);
  assert.deepEqual(parseAndValidateOllamaOutput(JSON.stringify(valid), [source]).sourceIds, [
    'source-1',
  ]);
});
test('strict JSON parser rejects unsupported named content', () =>
  assert.throws(
    () =>
      parseAndValidateOllamaOutput(
        JSON.stringify({ ...valid, summary: 'Officials said Patrick Mahomes announced it.' }),
        [source],
      ),
    /Unsupported named fact/,
  ));

test('title and excerpt both support team, opponent, organization, and outcome facts', () => {
  const supported: ContentSource = {
    ...source,
    title: 'Chicago Bears earn preseason victory over Titans',
    excerpt: 'The Detroit Lions later face the Indianapolis Colts in Detroit.',
  };
  const output = {
    ...valid,
    headline: 'Bears top Titans in preseason contest',
    summary: 'Chicago secured the victory while Detroit prepares to meet Indianapolis.',
    whatHappened: 'The Chicago Bears defeated the Titans.',
  };
  assert.doesNotThrow(() => parseAndValidateOllamaOutput(JSON.stringify(output), [supported]));
});

test('originality validation rejects copied headlines and full excerpt sentences', () => {
  assert.throws(
    () => assertOriginalWriting({ ...valid, headline: source.title }, [source]),
    /headline repeats/,
  );
  assert.throws(
    () =>
      assertOriginalWriting(
        {
          ...valid,
          summary: 'Kansas City signed Joe Example on Friday with a corresponding roster move.',
        },
        [
          {
            ...source,
            excerpt: 'Kansas City signed Joe Example on Friday with a corresponding roster move.',
          },
        ],
      ),
    /copies a source sentence/,
  );
});

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
