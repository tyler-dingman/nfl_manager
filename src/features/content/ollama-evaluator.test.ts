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
  assert.match(source, /provider === 'ollama'\) throw error/);
  assert.doesNotMatch(source, /OPENAI_API_KEY &&/);
});
