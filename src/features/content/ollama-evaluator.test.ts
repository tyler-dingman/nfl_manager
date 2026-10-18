import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { loadOllamaEvaluationItems } from './ollama-evaluation-fixtures';

test('evaluation harness loads a fixed set of exactly 20 existing sources', async () =>
  assert.equal((await loadOllamaEvaluationItems()).length, 20));
test('evaluation harness has no publishing, database, or paid provider path', async () => {
  const source = await readFile('scripts/content-ollama-eval.ts', 'utf8');
  assert.doesNotMatch(source, /createStory|authDb|OpenAI|api\.openai/);
});
test('configured Ollama does not silently fall through to a paid provider', async () => {
  const source = await readFile('src/features/content/content-engine.ts', 'utf8');
  assert.match(source, /provider === 'ollama'[\s\S]*return new OllamaTopicSummarizer/);
  assert.match(source, /provider !== 'deterministic'\) throw error/);
  assert.doesNotMatch(source, /OPENAI_API_KEY &&/);
});
test('every configured inference provider propagates failures without placeholder summaries', async () => {
  const { TeamContentEngine } = await import('./content-engine');
  const prior = process.env.CONTENT_AI_PROVIDER;
  try {
    for (const provider of ['ollama', 'openai', 'workers-ai']) {
      process.env.CONTENT_AI_PROVIDER = provider;
      const engine = new TeamContentEngine(
        [
          {
            collect: async () => [
              {
                id: 'provided-source',
                teamAbbr: 'KC',
                kind: 'official',
                publisher: 'Synthetic source',
                title: 'Supplied fact',
                url: 'https://example.invalid/fact',
                publishedAt: new Date().toISOString(),
                excerpt: 'Supplied factual excerpt',
                topicKey: 'fixture',
              },
            ],
          },
        ],
        {
          summarize: async () => {
            throw Error('Synthetic provider failure');
          },
        },
      );
      await assert.rejects(
        engine.buildBriefings(`TEST-${provider}`, 'Synthetic team'),
        /Synthetic provider failure/,
      );
    }
  } finally {
    if (prior === undefined) delete process.env.CONTENT_AI_PROVIDER;
    else process.env.CONTENT_AI_PROVIDER = prior;
  }
});
