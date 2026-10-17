import test from 'node:test';
import assert from 'node:assert/strict';
import { OpenAITopicSummarizer } from './openai-summarizer';
import { assertPaidInferenceAllowed } from './cost-policy';

test('zero-cost inference refuses paid requests before network access without substituting output', async () => {
  const previous = process.env.INFRASTRUCTURE_COST_POLICY;
  process.env.INFRASTRUCTURE_COST_POLICY = 'zero-cost';
  try {
    await assert.rejects(
      new OpenAITopicSummarizer('synthetic', 'synthetic').summarize({
        teamAbbr: 'KC',
        teamName: 'Kansas City Chiefs',
        topicKey: 'synthetic',
        sources: [],
      }),
      /blocked by the zero-cost policy/,
    );
  } finally {
    if (previous === undefined) delete process.env.INFRASTRUCTURE_COST_POLICY;
    else process.env.INFRASTRUCTURE_COST_POLICY = previous;
  }
  assert.throws(() => assertPaidInferenceAllowed({ INFRASTRUCTURE_COST_POLICY: 'typo' }));
  assert.doesNotThrow(() => assertPaidInferenceAllowed({ INFRASTRUCTURE_COST_POLICY: 'standard' }));
});
