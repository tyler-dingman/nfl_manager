import { STORY_ENGINE_THRESHOLDS } from './config';
import type { ContentCandidate, RegisteredSource, StoryRecord, SynthesizedStory } from './types';
import {
  evidenceCounts,
  isOfficialSource,
  publisherKey,
  type StoryEvidence,
} from './corroboration';

export type PublishingAction = 'AUTO_PUBLISH' | 'REVIEW_REQUIRED' | 'DO_NOT_PUBLISH';
export type PublishingOverride = 'FORCE_PUBLISH' | 'FORCE_REVIEW' | 'HIDE' | null;
export type PolicyEvidence = StoryEvidence;
export type PublishingDecision = {
  action: PublishingAction;
  reason: string;
  confidence: number;
  breaking: boolean;
};
const uncertain =
  /\brumou?r|speculat|anonymous|could|might|may |believe|opinion|reportedly|conflicting|dispute|unconfirmed\b/i;
const editorialFraming =
  /\b(?:winners?|losers?|rankings?|predictions?|hypothetical|wish\s?list|underdogs?|steals?|gamble|options?|reasons? why)\b/i;
const factualTypes = new Set([
  'TRADE',
  'SIGNING',
  'RELEASE',
  'TRANSACTION',
  'INJURY',
  'PRACTICE',
  'DEPTH_CHART',
  'CONTRACT',
  'COACHING',
  'SUSPENSION',
  'GAME',
  'SCHEDULE',
  'ROSTER',
]);
const evidenceConflicts = (evidence: PolicyEvidence[]) => {
  const texts = evidence.map(({ candidate }) =>
    `${candidate.title} ${candidate.excerpt}`.toLowerCase(),
  );
  const has = (pattern: RegExp) => texts.some((text) => pattern.test(text));
  return (
    (has(/\b(out|ruled out)\b/) && has(/\b(questionable|expected to play|available)\b/)) ||
    (has(/\b(trade completed|has traded|acquired|acquires)\b/) &&
      has(/\b(trade talks?|discussions?|considering|could trade|may trade)\b/))
  );
};
export function evaluatePublishingPolicy(input: {
  story: SynthesizedStory | StoryRecord;
  storyType: string;
  evidence: PolicyEvidence[];
  clusterConfidence?: number;
  override?: PublishingOverride;
}): PublishingDecision {
  const { story, evidence } = input,
    confidence = story.confidenceScore;
  if (input.override === 'HIDE')
    return {
      action: 'DO_NOT_PUBLISH',
      reason: 'An editor hid this story.',
      confidence,
      breaking: false,
    };
  if (input.override === 'FORCE_REVIEW')
    return {
      action: 'REVIEW_REQUIRED',
      reason: 'An editor required review.',
      confidence,
      breaking: false,
    };
  if (input.override === 'FORCE_PUBLISH')
    return {
      action: 'AUTO_PUBLISH',
      reason: 'An editor explicitly approved publication.',
      confidence,
      breaking: story.importanceScore >= STORY_ENGINE_THRESHOLDS.breakingImportance,
    };
  if (!evidence.length || confidence < 50)
    return {
      action: 'DO_NOT_PUBLISH',
      reason: 'The story lacks sufficient grounded evidence.',
      confidence,
      breaking: false,
    };
  if (evidence.some((e) => e.supportType === 'CONTRADICTS') || evidenceConflicts(evidence))
    return {
      action: 'REVIEW_REQUIRED',
      reason: 'Available evidence contains conflicting reports.',
      confidence,
      breaking: false,
    };
  const text = `${story.headline} ${story.summary} ${story.whatHappened}`;
  const publisherApproved =
    evidence.length > 0 && evidence.every((item) => item.source.metadata.publishAll === true);
  if (!publisherApproved && uncertain.test(text))
    return {
      action: 'REVIEW_REQUIRED',
      reason: 'The story contains rumor, speculation, or uncertain attribution.',
      confidence,
      breaking: false,
    };
  if (!publisherApproved && editorialFraming.test(text))
    return {
      action: 'REVIEW_REQUIRED',
      reason:
        'The item is framed as analysis, ranking, prediction, or reaction rather than a concrete factual event.',
      confidence,
      breaking: false,
    };
  if ((input.clusterConfidence ?? 1) < 0.72)
    return {
      action: 'REVIEW_REQUIRED',
      reason: 'Clustering or synthesis confidence requires editorial review.',
      confidence,
      breaking: false,
    };
  const official = evidence.some((e) => isOfficialSource(e.source));
  const tierOne = evidence.some(
    (e) => e.source.pollingTier === 'A' && e.supportType !== 'CONTRADICTS',
  );
  const counts = evidenceCounts(evidence);
  const reliable = evidence.filter((e) => e.source.reliabilityScore >= 0.9);
  const reliablePublishers = new Set(reliable.map((e) => publisherKey(e.source))).size;
  const grounded =
    story instanceof Object && 'claims' in story
      ? (story as SynthesizedStory).claims.every((c) => c.sourceEvidenceIds.length > 0)
      : true;
  const factual = factualTypes.has(input.storyType) || publisherApproved;
  if (!grounded)
    return {
      action: 'DO_NOT_PUBLISH',
      reason: 'Generated claims are not linked to source evidence.',
      confidence,
      breaking: false,
    };
  const tierOneQualified =
    factual &&
    (official || tierOne) &&
    confidence >= STORY_ENGINE_THRESHOLDS.tierOnePublishConfidence;
  const corroboratedTierTwoQualified =
    factual &&
    counts.independentSourceCount >= 2 &&
    confidence >= STORY_ENGINE_THRESHOLDS.corroboratedTierTwoPublishConfidence;
  const legacyTrustedQualified =
    factual &&
    reliablePublishers >= 2 &&
    confidence >= STORY_ENGINE_THRESHOLDS.autoPublishConfidence;
  const tierTwoSingleQualified =
    factual &&
    counts.independentSourceCount === 1 &&
    evidence.some((item) => item.source.pollingTier === 'B') &&
    confidence >= STORY_ENGINE_THRESHOLDS.tierTwoSinglePublishConfidence;
  const tierThreeSingleQualified =
    factual &&
    counts.publisherCount >= 1 &&
    evidence.every((item) => item.source.pollingTier === 'C') &&
    confidence >= STORY_ENGINE_THRESHOLDS.tierThreeSinglePublishConfidence;
  if (
    tierOneQualified ||
    corroboratedTierTwoQualified ||
    legacyTrustedQualified ||
    tierTwoSingleQualified ||
    tierThreeSingleQualified
  )
    return {
      action: 'AUTO_PUBLISH',
      reason: tierOneQualified
        ? official
          ? 'Tier 1 official factual Chiefs development can publish immediately.'
          : 'Tier 1 factual Chiefs development can publish immediately.'
        : corroboratedTierTwoQualified || legacyTrustedQualified
          ? `${counts.independentSourceCount} independent qualifying publishers corroborate the same factual development.`
          : tierTwoSingleQualified
            ? publisherApproved
              ? 'Configured source is approved for automatic Beat publishing.'
              : 'Tier 2 factual Chiefs development qualifies under all-tier publishing mode.'
            : 'Tier 3 factual Chiefs development qualifies under all-tier publishing mode.',
      confidence,
      breaking: story.importanceScore >= STORY_ENGINE_THRESHOLDS.breakingImportance,
    };
  const singleTierTwo =
    factual &&
    counts.independentSourceCount === 1 &&
    evidence.some((item) => item.source.pollingTier === 'B');
  return {
    action: 'REVIEW_REQUIRED',
    reason: singleTierTwo
      ? 'Pending independent Tier 2 corroboration or Tier 1 confirmation.'
      : 'Evidence is credible but does not meet automatic publication criteria.',
    confidence,
    breaking: false,
  };
}
export const publicationStateFor = (decision: PublishingDecision) =>
  decision.action === 'AUTO_PUBLISH'
    ? 'AUTO_PUBLISHED'
    : decision.action === 'REVIEW_REQUIRED'
      ? 'REVIEW_REQUIRED'
      : 'REJECTED';
