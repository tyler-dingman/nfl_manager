import { z } from 'zod';
import { TEAM_LIST } from '@/data/teams';
import { assertLocalOllamaUrl, getContentAiConfig } from './ai-provider';
import type { ContentSource, SummarizedTopic, TopicSummarizer } from './types';

export const ollamaOutputSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['category', 'headline', 'summary', 'whatHappened', 'whyItMatters', 'whatsNext'],
  properties: {
    category: { type: 'string' },
    headline: { type: 'string' },
    summary: { type: 'string' },
    whatHappened: { type: 'string' },
    whyItMatters: { type: ['string', 'null'] },
    whatsNext: { type: ['string', 'null'] },
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
  })
  .strict();

export type OllamaMetrics = {
  latencyMs: number;
  firstPassLatencyMs: number;
  retryLatencyMs: number | null;
  promptTokens: number | null;
  outputTokens: number | null;
  retries: number;
  firstPassFailure: string | null;
};
const sourceInput = (sources: ContentSource[]) =>
  sources.map(({ publisher, title, url, publishedAt, excerpt }) => ({
    publisher,
    title,
    url,
    publishedAt,
    excerpt,
  }));
type OllamaGeneratedTopic = Omit<SummarizedTopic, 'sourceIds'>;
const generatedText = (value: OllamaGeneratedTopic) =>
  [value.summary, value.whatHappened, value.whyItMatters, value.whatsNext]
    .filter(Boolean)
    .join('. ');

export function parseAndValidateOllamaOutput(
  content: string,
  sources: ContentSource[],
): SummarizedTopic {
  const parsed = parsedSchema.parse(JSON.parse(content));
  const rawEvidence = sources
    .map((source) => `${source.title} ${source.excerpt} ${source.publisher}`)
    .join(' ')
    .replace(/&#8217;|&#x2019;|&rsquo;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
  const teamAliases = TEAM_LIST.filter((team) => {
    const nickname = team.name.split(' ').at(-1) ?? team.name;
    return [team.name, team.city, nickname].some((value) =>
      new RegExp(`\\b${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(rawEvidence),
    );
  })
    .map((team) => `${team.name} ${team.city}`)
    .join(' ');
  const evidence = `${rawEvidence} ${teamAliases}`.toLowerCase();
  const editorialWords = new Set([
    'a',
    'an',
    'the',
    'this',
    'that',
    'what',
    'why',
    'next',
    'breaking',
    'developing',
    'report',
    'reports',
    'update',
    'updates',
    'team',
    'roster',
    'preseason',
    'victory',
  ]);
  const properPhrases = generatedText(parsed)
    .split(/(?<=[.!?])\s+/)
    .flatMap((sentence) => {
      const withoutSentenceLead = sentence.replace(/^\s*[A-Z][A-Za-z'-]*\s+/, '');
      return withoutSentenceLead.match(/\b[A-Z][A-Za-z'-]+(?:[ \t]+[A-Z][A-Za-z'-]+)+\b/g) ?? [];
    });
  const unsupported = properPhrases.find((phrase) => {
    const meaningfulTokens = phrase
      .toLowerCase()
      .split(/\s+/)
      .filter((token) => !editorialWords.has(token));
    return meaningfulTokens.some(
      (token) =>
        !evidence.match(new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')),
    );
  });
  if (unsupported) throw new Error(`Unsupported named fact detected: ${unsupported}`);
  const evidenceRaw = rawEvidence;
  const generatedRaw = generatedText(parsed);
  const unsupportedNumber = (generatedRaw.match(/\b\d+(?:[.,:]\d+)?\b/g) ?? []).find(
    (value) => !evidenceRaw.includes(value),
  );
  if (unsupportedNumber) throw new Error(`Unsupported number detected: ${unsupportedNumber}`);
  const unsupportedQuote = (generatedRaw.match(/[“"]([^”"]+)[”"]/g) ?? []).find(
    (quote) => !evidenceRaw.includes(quote.replace(/[“”]/g, '"')),
  );
  if (unsupportedQuote) throw new Error(`Unsupported quote detected: ${unsupportedQuote}`);
  assertNoUnsupportedTransformations(parsed, sources);
  assertOriginalWriting(parsed, sources);
  return { ...parsed, sourceIds: sources.map((source) => source.id) };
}

const normalizeCopy = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
export function sourceSimilarity(summary: string, sources: ContentSource[]) {
  const outputWords = new Set(normalizeCopy(summary).split(' ').filter(Boolean));
  const sourceWords = new Set(
    sources.flatMap((source) => normalizeCopy(source.excerpt).split(' ')).filter(Boolean),
  );
  const intersection = [...outputWords].filter((word) => sourceWords.has(word)).length;
  const union = new Set([...outputWords, ...sourceWords]).size;
  return union ? intersection / union : 0;
}
export function assertOriginalWriting(output: OllamaGeneratedTopic, sources: ContentSource[]) {
  const sourceTitles = sources.map((source) => normalizeCopy(source.title));
  if (sourceTitles.includes(normalizeCopy(output.headline)))
    throw new Error('Originality validation failed: headline repeats the source title.');
  const sourceSentences = sources
    .flatMap((source) => source.excerpt.split(/(?<=[.!?])\s+/))
    .map(normalizeCopy)
    .filter((sentence) => sentence.split(' ').length >= 8);
  const copied = output.summary
    .split(/(?<=[.!?])\s+/)
    .map(normalizeCopy)
    .find((sentence) => sourceSentences.includes(sentence));
  if (copied) throw new Error('Originality validation failed: summary copies a source sentence.');
  if (sourceSimilarity(output.summary, sources) > 0.72)
    throw new Error('Originality validation failed: summary is too similar to source wording.');
}

export function assertNoUnsupportedTransformations(
  output: OllamaGeneratedTopic,
  sources: ContentSource[],
) {
  const evidence = sources.map((source) => `${source.title} ${source.excerpt}`).join(' ');
  const generated = generatedText(output);
  if (
    /\b(?:reportedly|reports?|according to)\b/i.test(evidence) &&
    !/\b(?:reportedly|reports?|according to)\b/i.test(generated)
  )
    throw new Error('Factual validation failed: reported information was stated as confirmed.');
  if (
    /\bagree(?:d|s)? to terms?\b/i.test(evidence) &&
    /\b(?:finalized|completed)\b/i.test(generated)
  )
    throw new Error('Factual validation failed: an agreement was escalated to a finalized action.');
  const roles = [
    'coach',
    'analyst',
    'quarterback',
    'running back',
    'wide receiver',
    'tight end',
    'offensive lineman',
    'defensive end',
    'safety',
  ];
  for (const role of roles) {
    const rolePattern = role.replace(/^[a-z]/, (letter) => `[${letter}${letter.toUpperCase()}]`);
    const matches =
      generated.match(
        new RegExp(`\\b${rolePattern}\\s+([A-Z][A-Za-z'-]+(?:\\s+[A-Z][A-Za-z'-]+)+)`, 'g'),
      ) ?? [];
    for (const attribution of matches) {
      const supported =
        evidence.toLowerCase().includes(attribution.toLowerCase()) ||
        (role === 'quarterback' &&
          evidence
            .toLowerCase()
            .includes(attribution.replace(/^quarterback/i, 'QB').toLowerCase()));
      if (!supported)
        throw new Error(`Factual validation failed: unsupported role attribution: ${attribution}`);
    }
  }
  const unsupportedPhrases = [
    'official confirmation',
    'final step',
    'season squad',
    'strategic shift',
    'player lineup',
  ];
  const unsupportedPhrase = unsupportedPhrases.find(
    (phrase) =>
      generated.toLowerCase().includes(phrase) && !evidence.toLowerCase().includes(phrase),
  );
  if (unsupportedPhrase)
    throw new Error(`Factual validation failed: unsupported context: ${unsupportedPhrase}`);
  if (/\bannounc(?:e|ed|ement)\b/i.test(generated) && !/\bannounc(?:e|ed|ement)\b/i.test(evidence))
    throw new Error('Factual validation failed: an announcement was not present in the evidence.');
  if (/\bsignaling\b/i.test(generated) && !/\bsignaling\b/i.test(evidence))
    throw new Error('Factual validation failed: unsupported interpretation was added.');
}

export class OllamaOutputValidationError extends Error {
  constructor(
    message: string,
    readonly retries: number,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
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
    let promptTokens = 0;
    let outputTokens = 0;
    let validationFailure = '';
    let firstPassFailure: string | null = null;
    let firstPassLatencyMs = 0;
    let retryLatencyMs: number | null = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      const attemptStarted = performance.now();
      let response: Response;
      try {
        response = await fetch(`${this.baseUrl}/api/chat`, {
          method: 'POST',
          signal: AbortSignal.timeout(60_000),
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
                  'You are the sourced news editor for Down & Distance. The source title and source excerpt are equally authoritative evidence. Extract facts only from those two fields. Write an original D&D headline and concise original summary while preserving factual meaning. Do not repeat the source headline verbatim, copy full sentences, or closely mirror the excerpt structure. Never infer or invent names, roles, dates, quotes, injuries, transactions, outcomes, opponents, locations, roster implications, relationships, motivations, or future events. Preserve qualifiers: reported or agreed actions must not become confirmed, completed, or finalized. whyItMatters and whatsNext must be null when unsupported. Internal source IDs are attached by the application and must not appear in your response. Return strict JSON matching the schema.',
              },
              {
                role: 'user',
                content: JSON.stringify({
                  teamAbbr,
                  teamName,
                  topicKey,
                  sources: sourceInput(sources),
                  ...(validationFailure
                    ? {
                        correction: `Rewrite the prior result because validation failed: ${validationFailure}`,
                      }
                    : {}),
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
      promptTokens += payload.prompt_eval_count ?? 0;
      outputTokens += payload.eval_count ?? 0;
      const attemptLatencyMs = Math.round(performance.now() - attemptStarted);
      if (attempt === 0) firstPassLatencyMs = attemptLatencyMs;
      else retryLatencyMs = attemptLatencyMs;
      if (!payload.message?.content) validationFailure = 'Local Ollama returned no content.';
      else {
        try {
          return {
            output: parseAndValidateOllamaOutput(payload.message.content, sources),
            metrics: {
              latencyMs: Math.round(performance.now() - started),
              firstPassLatencyMs,
              retryLatencyMs,
              promptTokens: promptTokens || null,
              outputTokens: outputTokens || null,
              retries: attempt,
              firstPassFailure,
            },
          };
        } catch (error) {
          validationFailure = error instanceof Error ? error.message : String(error);
          if (attempt === 0) firstPassFailure = validationFailure;
        }
      }
    }
    throw new OllamaOutputValidationError(validationFailure, 1);
  }
}
