import type {
  RegisteredSource,
  StoryRecord,
  ContentCandidate,
  SynthesizedStory,
  GeneratedClaim,
} from './types';
import { calculateImportanceScore } from '@/features/three-and-out/ranking';
import { evidenceCounts, isOfficialSource } from './corroboration';
import { getContentAiConfig } from '@/features/content/ai-provider';
import { OllamaStorySynthesizer } from './ollama-synthesis';

const neutralHeadline = (candidate: ContentCandidate) => {
  const entity = candidate.entities.find(
    (value) => !/kansas city|chiefs|andy reid|national football league|nfl/i.test(value),
  );
  if (!entity) return candidate.title;
  switch (candidate.storyType) {
    case 'TRADE':
      return `Chiefs acquire ${entity} in trade`;
    case 'SIGNING':
      return `Chiefs sign ${entity}`;
    case 'RELEASE':
      return `Chiefs release ${entity}`;
    case 'INJURY':
      return `${entity} injury status updated`;
    case 'ROSTER':
    case 'PRACTICE':
    case 'DEPTH_CHART':
      return `Chiefs update ${entity}'s status`;
    case 'CONTRACT':
      return `Chiefs update ${entity}'s contract status`;
    case 'SUSPENSION':
      return `Chiefs update ${entity}'s availability`;
    case 'COACHING':
      return `Chiefs announce coaching update involving ${entity}`;
    default:
      return candidate.title;
  }
};
const candidateFact = (candidate: ContentCandidate) =>
  (candidate.excerpt || candidate.title)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)));

export interface StorySynthesizer {
  synthesize(input: {
    existingStory: StoryRecord | null;
    evidence: Array<{ candidate: ContentCandidate; source: RegisteredSource }>;
  }): Promise<SynthesizedStory>;
}

export function configuredStorySynthesizer(): StorySynthesizer {
  const provider = getContentAiConfig().provider;
  if (provider === 'ollama') return new OllamaStorySynthesizer();
  if (provider === 'openai')
    throw new Error('Paid story synthesis is not enabled for this local evaluation.');
  return new GroundedDeterministicStorySynthesizer();
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
      ...new Set(evidence.map(({ candidate }) => candidateFact(candidate)).filter(Boolean)),
    ];
    const claims: GeneratedClaim[] = uniqueFacts.map((text) => ({
      text,
      sourceEvidenceIds: evidence
        .filter(({ candidate }) => candidateFact(candidate) === text)
        .map(({ candidate }) => candidate.id ?? candidate.externalId),
      confidence: Math.max(
        ...evidence
          .filter(({ candidate }) => candidateFact(candidate) === text)
          .map(({ source }) => source.reliabilityScore),
      ),
    }));
    if (claims.some((claim) => !claim.sourceEvidenceIds.length))
      throw new Error('Unsupported generated claim.');
    const official = evidence.some(({ source }) => isOfficialSource(source));
    const counts = evidenceCounts(evidence);
    const strongestScore = Math.max(...evidence.map(({ source }) => source.reliabilityScore)) * 100;
    const confidenceScore = official
      ? Math.max(90, Math.round(strongestScore))
      : Math.min(
          96,
          Math.round(strongestScore + Math.max(0, counts.independentSourceCount - 1) * 12),
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
      headline:
        strongest.source.metadata.publishAll === true
          ? strongest.candidate.title
          : neutralHeadline(strongest.candidate),
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
