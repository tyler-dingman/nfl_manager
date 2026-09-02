import type {
  RegisteredSource,
  StoryRecord,
  ContentCandidate,
  SynthesizedStory,
  GeneratedClaim,
} from './types';
import { calculateImportanceScore } from '@/features/three-and-out/ranking';

export interface StorySynthesizer {
  synthesize(input: {
    existingStory: StoryRecord | null;
    evidence: Array<{ candidate: ContentCandidate; source: RegisteredSource }>;
  }): Promise<SynthesizedStory>;
}

export class GroundedDeterministicStorySynthesizer implements StorySynthesizer {
  async synthesize({
    existingStory,
    evidence,
  }: Parameters<StorySynthesizer['synthesize']>[0]): Promise<SynthesizedStory> {
    if (!evidence.length) throw new Error('Story synthesis requires evidence.');
    const strongest = [...evidence].sort(
      (a, b) => b.source.reliabilityScore - a.source.reliabilityScore,
    )[0];
    const uniqueFacts = [
      ...new Set(evidence.map(({ candidate }) => candidate.excerpt).filter(Boolean)),
    ];
    const claims: GeneratedClaim[] = uniqueFacts.map((text) => ({
      text,
      sourceEvidenceIds: evidence
        .filter(({ candidate }) => candidate.excerpt === text)
        .map(({ candidate }) => candidate.id ?? candidate.externalId),
      confidence: Math.max(
        ...evidence
          .filter(({ candidate }) => candidate.excerpt === text)
          .map(({ source }) => source.reliabilityScore),
      ),
    }));
    if (claims.some((claim) => !claim.sourceEvidenceIds.length))
      throw new Error('Unsupported generated claim.');
    const official = evidence.some(
      ({ source }) => source.sourceType === 'OFFICIAL_TEAM' || source.sourceType === 'NFL_OFFICIAL',
    );
    const confidenceScore = Math.round(
      Math.max(...evidence.map(({ source }) => source.reliabilityScore)) * 100,
    );
    const importanceScore = calculateImportanceScore({
      footballImpact: ['TRADE', 'INJURY', 'SIGNING', 'RELEASE'].includes(
        strongest.candidate.storyType,
      )
        ? 90
        : 65,
      sourceStrength: confidenceScore,
      velocity: Math.min(100, evidence.length * 25),
      freshness: 95,
      fanInterest: 70,
      novelty: existingStory ? 50 : 90,
    });
    return {
      headline: strongest.candidate.title,
      summary: uniqueFacts.slice(0, 3).join(' '),
      whatHappened: uniqueFacts.slice(0, 2).join(' '),
      whyItMatters: existingStory?.whyItMatters ?? '',
      whatsNext: '',
      status: /resolved|final|completed/i.test(strongest.candidate.text)
        ? 'RESOLVED'
        : official
          ? 'BREAKING'
          : 'DEVELOPING',
      importanceScore,
      confidenceScore,
      claims,
    };
  }
}
