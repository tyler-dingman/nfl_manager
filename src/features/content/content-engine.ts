import { CanonicalEventAdapter } from './canonical-event-adapter';
import { DeterministicTopicSummarizer } from './deterministic-summarizer';
import { MockContentSourceAdapter } from './mock-source-adapter';
import { OpenAITopicSummarizer } from './openai-summarizer';
import { OllamaTopicSummarizer } from './ollama-summarizer';
import { getContentAiConfig } from './ai-provider';
import type { ContentSource, ContentSourceAdapter, TeamBriefing, TopicSummarizer } from './types';

type CacheEntry = { expiresAt: number; briefings: TeamBriefing[] };

const briefingCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000;

const groupByTopic = (sources: ContentSource[]) => {
  const groups = new Map<string, ContentSource[]>();
  sources.forEach((source) =>
    groups.set(source.topicKey, [...(groups.get(source.topicKey) ?? []), source]),
  );
  return groups;
};

const scoreTopic = (sources: ContentSource[]) => {
  const importance = Math.max(...sources.map((source) => source.importance ?? 50));
  const sourceDiversity = new Set(sources.map((source) => source.publisher)).size * 3;
  const newestTimestamp = Math.max(
    ...sources.map((source) => new Date(source.publishedAt).getTime()).filter(Number.isFinite),
  );
  const ageInHours = Math.max(0, (Date.now() - newestTimestamp) / 3_600_000);
  const recency = Math.max(0, 24 - ageInHours);
  return importance + sourceDiversity + recency;
};

const selectSummarizer = (): TopicSummarizer => {
  const config = getContentAiConfig();
  if (config.provider === 'ollama') return new OllamaTopicSummarizer();
  if (config.provider === 'openai') {
    if (!process.env.OPENAI_API_KEY || !process.env.OPENAI_CONTENT_MODEL)
      throw new Error(
        'CONTENT_AI_PROVIDER=openai requires OPENAI_API_KEY and OPENAI_CONTENT_MODEL.',
      );
    return new OpenAITopicSummarizer(process.env.OPENAI_API_KEY, process.env.OPENAI_CONTENT_MODEL);
  }
  return new DeterministicTopicSummarizer();
};

export class TeamContentEngine {
  private readonly fallbackSummarizer = new DeterministicTopicSummarizer();

  constructor(
    private readonly adapters: ContentSourceAdapter[] = [
      new CanonicalEventAdapter(),
      new MockContentSourceAdapter(),
    ],
    private readonly summarizer: TopicSummarizer = selectSummarizer(),
  ) {}

  async buildBriefings(teamAbbr: string, teamName: string): Promise<TeamBriefing[]> {
    const cacheKey = teamAbbr.toUpperCase();
    const cached = briefingCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.briefings;

    const sourceGroups = await Promise.all(
      this.adapters.map((adapter) => adapter.collect(cacheKey, teamName)),
    );
    const sources = sourceGroups.flat();
    const briefings = await Promise.all(
      [...groupByTopic(sources)]
        .sort(([, left], [, right]) => scoreTopic(right) - scoreTopic(left))
        .map(async ([topicKey, topicSources]) => {
          const summaryInput = { teamAbbr: cacheKey, teamName, topicKey, sources: topicSources };
          let generated;
          try {
            generated = await this.summarizer.summarize(summaryInput);
          } catch (error) {
            console.error(`[content-engine] summarizer failed for ${cacheKey}/${topicKey}`, error);
            if (getContentAiConfig().provider === 'ollama') throw error;
            generated = await this.fallbackSummarizer.summarize(summaryInput);
          }
          const selectedIds = new Set(generated.sourceIds);
          const citedSources = topicSources.filter((source) => selectedIds.has(source.id));
          const updatedAt = topicSources.reduce(
            (latest, source) => (source.publishedAt > latest ? source.publishedAt : latest),
            topicSources[0]?.publishedAt ?? new Date().toISOString(),
          );
          return {
            id: `${cacheKey.toLowerCase()}-${topicKey}`,
            teamAbbr: cacheKey,
            ...generated,
            imageUrl: topicSources.find((source) => source.imageUrl)?.imageUrl ?? null,
            updatedAt,
            sourceCount: citedSources.length,
            sources: citedSources.map(({ id, kind, publisher, title, url, publishedAt }) => ({
              id,
              kind,
              publisher,
              title,
              url,
              publishedAt,
            })),
          } satisfies TeamBriefing;
        }),
    );

    briefingCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, briefings });
    return briefings;
  }
}

export const teamContentEngine = new TeamContentEngine();
