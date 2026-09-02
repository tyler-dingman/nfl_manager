import { STORY_ENGINE_THRESHOLDS } from './config';
import type { ContentCandidate, RegisteredSource, StoryRecord, SynthesizedStory } from './types';

export type PublishingAction = 'AUTO_PUBLISH' | 'REVIEW_REQUIRED' | 'DO_NOT_PUBLISH';
export type PublishingOverride = 'FORCE_PUBLISH' | 'FORCE_REVIEW' | 'HIDE' | null;
export type PolicyEvidence = {
  candidate: ContentCandidate;
  source: RegisteredSource;
  supportType?: 'SUPPORTS' | 'CONTRADICTS' | 'CORRECTS' | 'OFFICIAL_CONFIRMATION';
};
export type PublishingDecision = {
  action: PublishingAction;
  reason: string;
  confidence: number;
  breaking: boolean;
};
const uncertain =
  /\brumou?r|speculat|anonymous|could|might|may |believe|opinion|reportedly|conflicting|dispute|unconfirmed\b/i;
const factualTypes = new Set([
  'TRADE',
  'SIGNING',
  'RELEASE',
  'TRANSACTION',
  'INJURY',
  'PRACTICE',
  'GAME',
  'SCHEDULE',
  'ROSTER',
]);
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
  if (evidence.some((e) => e.supportType === 'CONTRADICTS'))
    return {
      action: 'REVIEW_REQUIRED',
      reason: 'Available evidence contains conflicting reports.',
      confidence,
      breaking: false,
    };
  const text = `${story.headline} ${story.summary} ${story.whatHappened}`;
  if (uncertain.test(text))
    return {
      action: 'REVIEW_REQUIRED',
      reason: 'The story contains rumor, speculation, or uncertain attribution.',
      confidence,
      breaking: false,
    };
  if ((input.clusterConfidence ?? 1) < 0.72 || confidence < 80)
    return {
      action: 'REVIEW_REQUIRED',
      reason: 'Clustering or synthesis confidence requires editorial review.',
      confidence,
      breaking: false,
    };
  const official = evidence.some((e) =>
    ['OFFICIAL_TEAM', 'NFL_OFFICIAL'].includes(e.source.sourceType),
  );
  const reliable = evidence.filter((e) => e.source.reliabilityScore >= 0.9);
  const grounded =
    story instanceof Object && 'claims' in story
      ? (story as SynthesizedStory).claims.every((c) => c.sourceEvidenceIds.length > 0)
      : true;
  const approvedFact = factualTypes.has(input.storyType) && (official || reliable.length >= 2);
  if (!grounded)
    return {
      action: 'DO_NOT_PUBLISH',
      reason: 'Generated claims are not linked to source evidence.',
      confidence,
      breaking: false,
    };
  if (approvedFact && confidence >= 90)
    return {
      action: 'AUTO_PUBLISH',
      reason: official
        ? 'High-confidence factual update from an official source.'
        : 'High-confidence factual update corroborated by trusted sources.',
      confidence,
      breaking: story.importanceScore >= STORY_ENGINE_THRESHOLDS.breakingImportance,
    };
  return {
    action: 'REVIEW_REQUIRED',
    reason: 'Evidence is credible but does not meet automatic publication criteria.',
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
