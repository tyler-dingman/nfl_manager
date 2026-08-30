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
  sources.map(({ id, publisher, title, url, publishedAt, excerpt }) => ({
    id,
    publisher,
    title,
    url,
    publishedAt,
    excerpt,
  }));

export class OllamaTopicSummarizer implements TopicSummarizer {
  constructor(
    private readonly model = process.env.OLLAMA_CONTENT_MODEL ?? 'qwen3:4b',
    private readonly baseUrl = process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434',
  ) {}

  async summarize({
    teamAbbr,
    teamName,
    topicKey,
    sources,
  }: Parameters<TopicSummarizer['summarize']>[0]) {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        stream: false,
        think: false,
        format: outputSchema,
        options: { temperature: 0 },
        messages: [
          {
            role: 'system',
            content:
              'You are the sourced news editor for Down & Distance. Use only facts explicitly present in the supplied title and excerpt. Never infer or speculate about roster impact, depth, motivation, future matchups, team needs, player quality, or a person\'s prior/current organization. Do not add names, dates, locations, quotes, injuries, transactions, or certainty that the source does not state. Write an original, factual football headline and a concise 1-2 sentence summary. Set whyItMatters to null unless the supplied text explicitly states a concrete impact; never manufacture an impact merely to fill the field. Return every supplied source ID that supports the result.',
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

    if (!response.ok) throw new Error(`Ollama summarization failed: ${response.status}`);
    const payload = (await response.json()) as { message?: { content?: string } };
    if (!payload.message?.content) throw new Error('Ollama returned no summary content');
    const parsed = JSON.parse(payload.message.content) as SummarizedTopic;
    const allowedIds = new Set(sources.map((source) => source.id));
    return { ...parsed, sourceIds: parsed.sourceIds.filter((id) => allowedIds.has(id)) };
  }
}
