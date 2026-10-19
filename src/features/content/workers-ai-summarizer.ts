import { z } from 'zod';
import { SharedInference, WorkersInference } from '../../../packages/storage/ai';
import { digest, utf8 } from '../../../packages/storage/core';
import { applicationStorage, applicationAi } from '../../server/persistence/bindings';
import type { TopicSummarizer } from './types';
const output = z.object({
  category: z.enum([
    'BREAKING',
    'ROSTER',
    'INJURY',
    'GAME_PREVIEW',
    'GAME_RECAP',
    'ANALYSIS',
    'OTHER',
  ]),
  headline: z.string().min(1).max(300),
  summary: z.string().min(1).max(3000),
  whatHappened: z.string().min(1).max(3000),
  whyItMatters: z.string().max(3000).nullable(),
  whatsNext: z.string().max(3000).nullable(),
  sourceIds: z.array(z.string()).min(1),
});
/** Opt-in only. Grounding validation does not establish editorial quality;
 * a reviewed comparison corpus is still a release gate. */
export class WorkersAITopicSummarizer implements TopicSummarizer {
  async summarize(input: Parameters<TopicSummarizer['summarize']>[0]) {
    const sourceVersion = await digest(utf8.encode(JSON.stringify(input))),
      prompt = `Use only the supplied NFL source facts. Never invent quotations, injuries, names or certainty. Return JSON only with category (BREAKING, ROSTER, INJURY, GAME_PREVIEW, GAME_RECAP, ANALYSIS or OTHER), headline, summary, whatHappened, whyItMatters (nullable), whatsNext (nullable), sourceIds (nonempty cited IDs from the input).\n${JSON.stringify(input)}`;
    const result = await new SharedInference(applicationStorage('D1_SHARED')).generate(
      new WorkersInference(applicationAi()),
      {
        team: input.teamAbbr,
        sourceVersion,
        policy: 'grounded-topics-v1',
        prompt,
        maxOutputTokens: 700,
      },
    );
    const parsed = output.parse(JSON.parse(result.text)),
      allowed = new Set(input.sources.map((s) => s.id));
    if (parsed.sourceIds.some((id) => !allowed.has(id)))
      throw Error('Inference cited an unprovided source');
    return parsed;
  }
}
