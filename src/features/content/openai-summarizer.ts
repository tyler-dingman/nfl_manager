import type { ContentSource, SummarizedTopic, TopicSummarizer } from './types';

const outputSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['category', 'headline', 'summary', 'whyItMatters', 'sourceIds'],
  properties: {
    category: { type: 'string' },
    headline: { type: 'string' },
    summary: { type: 'string' },
    whyItMatters: { type: ['string', 'null'] },
    sourceIds: { type: 'array', items: { type: 'string' } },
  },
} as const;

const sourceInput = (sources: ContentSource[]) =>
  sources.map(({ id, kind, publisher, title, publishedAt, excerpt }) => ({
    id,
    kind,
    publisher,
    title,
    publishedAt,
    excerpt,
  }));

export class OpenAITopicSummarizer implements TopicSummarizer {
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async summarize({
    teamAbbr,
    teamName,
    topicKey,
    sources,
  }: Parameters<TopicSummarizer['summarize']>[0]) {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        store: false,
        instructions:
          'You organize sourced NFL reporting into a fast fan briefing. Use only supplied facts. Do not invent names, quotes, URLs, injuries, or certainty. Write a clear headline and a 2-4 sentence summary. Return only source IDs that materially support the summary.',
        input: JSON.stringify({ teamAbbr, teamName, topicKey, sources: sourceInput(sources) }),
        text: {
          verbosity: 'low',
          format: {
            type: 'json_schema',
            name: 'team_briefing',
            strict: true,
            schema: outputSchema,
          },
        },
        max_output_tokens: 700,
      }),
    });

    if (!response.ok) throw new Error(`OpenAI summarization failed: ${response.status}`);
    const payload = (await response.json()) as { output_text?: string };
    if (!payload.output_text) throw new Error('OpenAI summarization returned no output text');
    const parsed = JSON.parse(payload.output_text) as SummarizedTopic;
    const allowedIds = new Set(sources.map((source) => source.id));
    return { ...parsed, sourceIds: parsed.sourceIds.filter((id) => allowedIds.has(id)) };
  }
}
