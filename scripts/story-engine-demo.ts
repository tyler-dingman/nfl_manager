import { findCandidateStory } from '../src/features/story-engine/clustering';
import { evaluateMaterialChange } from '../src/features/story-engine/material-change';
import { normalizeRawItem } from '../src/features/story-engine/normalization';
import { GroundedDeterministicStorySynthesizer } from '../src/features/story-engine/synthesis';
import type {
  RawSourceItem,
  RegisteredSource,
  StoryRecord,
} from '../src/features/story-engine/types';

const source = (id: string, official = false): RegisteredSource => ({
  id,
  name: id,
  sourceType: official ? 'OFFICIAL_TEAM' : 'LOCAL_OUTLET',
  teamId: 'KC',
  leagueWide: false,
  url: `https://${id.toLowerCase()}.example`,
  feedUrl: `https://${id.toLowerCase()}.example/feed`,
  fetchStrategy: 'FIXTURE',
  pollingTier: 'A',
  priority: 90,
  reliabilityScore: official ? 1 : 0.88,
  checkIntervalSeconds: 180,
  enabled: true,
  etag: null,
  lastModified: null,
  lastCheckedAt: null,
  lastSuccessfulAt: null,
  nextCheckAt: new Date(),
  failureCount: 0,
  lastError: null,
  metadata: { fixture: true },
});
const raw = (
  sourceId: string,
  externalId: string,
  title: string,
  excerpt: string,
  time: string,
): RawSourceItem => ({
  sourceId,
  externalId,
  url: `https://${sourceId.toLowerCase()}.example/${externalId}`,
  title,
  author: 'Fixture Reporter',
  publishedAt: time,
  updatedAt: null,
  rawText: excerpt,
  excerpt,
  media: [],
  fetchedAt: time,
});
async function main() {
  const local = source('KC_LOCAL'),
    official = source('KC_OFFICIAL', true),
    synthesizer = new GroundedDeterministicStorySynthesizer();
  const first = normalizeRawItem(
    raw(
      local.id,
      '1',
      'Chiefs trade for veteran tackle Alex Example',
      'Kansas City agreed to acquire veteran tackle Alex Example, pending a physical.',
      '2026-08-31T14:00:00Z',
    ),
    local,
  );
  let synthesized = await synthesizer.synthesize({
    existingStory: null,
    evidence: [{ candidate: { ...first, id: 'candidate-1' }, source: local }],
  });
  let story: StoryRecord = {
    id: 'story-1',
    teamId: 'KC',
    storyType: first.storyType,
    ...synthesized,
    publicationState: 'DRAFT',
    entities: first.entities,
    firstReportedAt: first.publishedAt,
    lastMeaningfulUpdateAt: first.publishedAt,
    version: 1,
  };
  console.log('1 new item -> StoryCreated v1', story.headline);
  console.log('2 exact duplicate -> ignored by unique source/external-id constraint');
  const second = normalizeRawItem(
    raw(
      official.id,
      '2',
      'Chiefs trade for veteran tackle Alex Example',
      'The Chiefs announced the trade and confirmed a 2027 conditional draft pick is the compensation.',
      '2026-08-31T15:00:00Z',
    ),
    official,
  );
  const match = findCandidateStory(second, [story]);
  console.log('3 second source -> cluster match', match);
  const change = evaluateMaterialChange(story, second, true);
  console.log('4 official material update ->', change);
  synthesized = await synthesizer.synthesize({
    existingStory: story,
    evidence: [
      { candidate: { ...first, id: 'candidate-1' }, source: local },
      { candidate: { ...second, id: 'candidate-2' }, source: official },
    ],
  });
  story = { ...story, ...synthesized, version: 2, lastMeaningfulUpdateAt: second.publishedAt };
  console.log('5 StoryUpdated v2 with grounded claims', synthesized.claims);
  const trivial = normalizeRawItem(
    raw(
      local.id,
      '3',
      story.headline,
      'The Chiefs announced the trade and confirmed a 2027 conditional draft pick is the compensation.',
      '2026-08-31T15:05:00Z',
    ),
    local,
  );
  console.log('6 wording-only/corroboration ->', evaluateMaterialChange(story, trivial));
  const resolved = normalizeRawItem(
    raw(
      official.id,
      '4',
      'Chiefs trade is complete after physical',
      'The transaction is final and the player passed his physical.',
      '2026-08-31T16:00:00Z',
    ),
    official,
  );
  console.log('7 resolution ->', evaluateMaterialChange(story, resolved, true));
  console.log('8 failed fetch -> retry with bounded exponential backoff (covered by test)');
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
