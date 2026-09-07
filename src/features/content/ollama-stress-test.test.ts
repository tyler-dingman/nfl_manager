import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { maxNewAiStoriesPerTeamPerDay } from '@/features/story-engine/generation-policy';

test('stress harness is fixed at 50, sequential, local-only, and read-only', async () => {
  const source = await readFile('scripts/content-ollama-stress-test.ts', 'utf8');
  assert.match(source, /const TOTAL = 50/);
  assert.match(source, /for \(const \[index, scenario\] of scenarios\.entries\(\)\)/);
  assert.match(source, /qwen3:4b-instruct/);
  assert.doesNotMatch(source, /INSERT INTO|UPDATE canonical|createStory|OpenAI|api\.openai/);
});

test('stress test does not change the ten-story per-team cap', () => {
  assert.equal(maxNewAiStoriesPerTeamPerDay({}), 10);
});
