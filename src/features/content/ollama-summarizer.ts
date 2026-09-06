import { z } from 'zod';
import { assertLocalOllamaUrl, getContentAiConfig } from './ai-provider';
import type { ContentSource, SummarizedTopic, TopicSummarizer } from './types';

export const ollamaOutputSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'category',
    'headline',
    'summary',
    'whatHappened',
    'whyItMatters',
    'whatsNext',
    'sourceIds',
  ],
  properties: {
    category: { type: 'string' },
    headline: { type: 'string' },
    summary: { type: 'string' },
    whatHappened: { type: 'string' },
    whyItMatters: { type: ['string', 'null'] },
    whatsNext: { type: ['string', 'null'] },
    sourceIds: { type: 'array', minItems: 1, items: { type: 'string' } },
  },
} as const;

const parsedSchema = z
  .object({
    category: z.string().min(1),
    headline: z.string().min(1),
    summary: z.string().min(1),
    whatHappened: z.string().min(1),
    whyItMatters: z.string().nullable(),
    whatsNext: z.string().nullable(),
    sourceIds: z.array(z.string()).min(1),
  })
  .strict();

export type OllamaMetrics = {
  latencyMs: number;
  promptTokens: number | null;
  outputTokens: number | null;
  retries: number;
};
const sourceInput = (sources: ContentSource[]) =>
  sources.map(({ id, publisher, title, url, publishedAt, excerpt }) => ({
    id,
    publisher,
    title,
    url,
    publishedAt,
    excerpt,
  }));
const generatedText = (value: SummarizedTopic) =>
  [value.headline, value.summary, value.whatHappened, value.whyItMatters, value.whatsNext]
    .filter(Boolean)
    .join(' ');

export function parseAndValidateOllamaOutput(
  content: string,
  sources: ContentSource[],
): SummarizedTopic {
  const parsed = parsedSchema.parse(JSON.parse(content));
  const allowedIds = new Set(sources.map((source) => source.id));
  const invalidId = parsed.sourceIds.find((id) => !allowedIds.has(id));
  if (invalidId) throw new Error(`Ollama cited an unknown source ID: ${invalidId}`);
  const evidence = sources
    .map((source) => `${source.title} ${source.excerpt} ${source.publisher}`)
    .join(' ')
    .toLowerCase();
  const names =
    generatedText(parsed).match(/\b[A-Z][A-Za-z'-]+(?:[ \t]+[A-Z][A-Za-z'-]+)+\b/g) ?? [];
  const unsupported = names.find(
    (name) => !evidence.includes(name.toLowerCase()) && name !== 'Down & Distance',
  );
  if (unsupported) throw new Error(`Unsupported named fact detected: ${unsupported}`);
  return parsed;
}

export class OllamaTopicSummarizer implements TopicSummarizer {
  private readonly model: string;
  private readonly baseUrl: string;
  constructor(model?: string, baseUrl?: string) {
    const config = getContentAiConfig();
    this.model = model ?? config.ollamaModel;
    this.baseUrl = assertLocalOllamaUrl(baseUrl ?? config.ollamaBaseUrl);
  }
  async summarize(input: Parameters<TopicSummarizer['summarize']>[0]) {
    return (await this.summarizeWithMetrics(input)).output;
  }
  async summarizeWithMetrics({
    teamAbbr,
    teamName,
    topicKey,
    sources,
  }: Parameters<TopicSummarizer['summarize']>[0]): Promise<{
    output: SummarizedTopic;
    metrics: OllamaMetrics;
  }> {
    const started = performance.now();
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          stream: false,
          think: false,
          format: ollamaOutputSchema,
          options: { temperature: 0 },
          messages: [
            {
              role: 'system',
              content:
                'You are the sourced news editor for Down & Distance. Use only facts explicitly present in supplied source titles and excerpts. Never infer or invent names, dates, quotes, injuries, transactions, roster implications, relationships, motivations, or future events. whyItMatters and whatsNext must be null when unsupported. Cite only supplied source IDs. Return strict JSON matching the schema.',
            },
            {
              role: 'user',
              content: JSON.stringify({
                teamAbbr,
                teamName,
                topicKey,
                sources: sourceInput(sources),
              }),
            },
          ],
        }),
      });
    } catch (error) {
      throw new Error(
        `Local Ollama is unavailable at ${this.baseUrl}. No cloud fallback was attempted.`,
        { cause: error },
      );
    }
    if (!response.ok)
      throw new Error(
        `Local Ollama failed with HTTP ${response.status}. No cloud fallback was attempted.`,
      );
    const payload = (await response.json()) as {
      message?: { content?: string };
      prompt_eval_count?: number;
      eval_count?: number;
    };
    if (!payload.message?.content) throw new Error('Local Ollama returned no content.');
    return {
      output: parseAndValidateOllamaOutput(payload.message.content, sources),
      metrics: {
        latencyMs: Math.round(performance.now() - started),
        promptTokens: payload.prompt_eval_count ?? null,
        outputTokens: payload.eval_count ?? null,
        retries: 0,
      },
    };
  }
}
