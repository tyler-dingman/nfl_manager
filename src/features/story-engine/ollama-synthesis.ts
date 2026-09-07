import { OllamaTopicSummarizer } from '@/features/content/ollama-summarizer';
import type { ContentSource, ContentSourceKind } from '@/features/content/types';
import { TEAM_LIST } from '@/data/teams';
import type { StorySynthesizer } from './synthesis';
import type { SynthesizedStory } from './types';

const kindFor = (sourceType: string): ContentSourceKind =>
  sourceType === 'YOUTUBE' ? 'video' : sourceType.includes('OFFICIAL') ? 'official' : 'reporting';

export class OllamaStorySynthesizer implements StorySynthesizer {
  constructor(private readonly summarizer = new OllamaTopicSummarizer()) {}
  async synthesize({
    existingStory,
    evidence,
  }: Parameters<StorySynthesizer['synthesize']>[0]): Promise<SynthesizedStory> {
    if (!evidence.length) throw new Error('Story synthesis requires evidence.');
    const sources: ContentSource[] = evidence.map(({ candidate, source }) => ({
      id: candidate.id ?? candidate.externalId,
      teamAbbr: candidate.candidateTeams[0] ?? source.teamId ?? 'NFL',
      kind: kindFor(source.sourceType),
      publisher: source.name,
      title: candidate.title,
      url: candidate.url,
      publishedAt: candidate.publishedAt,
      excerpt: candidate.excerpt || candidate.text || candidate.title,
      topicKey: candidate.fingerprint,
    }));
    const strongest = [...evidence].sort(
      (a, b) => b.source.reliabilityScore - a.source.reliabilityScore,
    )[0];
    const teamName =
      TEAM_LIST.find((team) => team.abbr === sources[0].teamAbbr)?.name ?? sources[0].teamAbbr;
    const output = await this.summarizer.summarize({
      teamAbbr: sources[0].teamAbbr,
      teamName,
      topicKey: strongest.candidate.fingerprint,
      sources,
    });
    const confidenceScore = Math.round(
      Math.max(...evidence.map(({ source }) => source.reliabilityScore)) * 100,
    );
    return {
      headline: output.headline,
      summary: output.summary,
      whatHappened: output.whatHappened ?? output.summary,
      whyItMatters: output.whyItMatters ?? '',
      whatsNext: output.whatsNext ?? '',
      status: existingStory
        ? 'DEVELOPING'
        : evidence.some(({ source }) => source.sourceType.includes('OFFICIAL'))
          ? 'BREAKING'
          : 'DEVELOPING',
      importanceScore: existingStory?.importanceScore ?? 70,
      confidenceScore,
      claims: [
        {
          text: output.whatHappened ?? output.summary,
          sourceEvidenceIds: output.sourceIds,
          confidence: confidenceScore / 100,
        },
      ],
    };
  }
}
