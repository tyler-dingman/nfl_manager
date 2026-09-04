import assert from 'node:assert/strict';
import test from 'node:test';
import { evidenceCounts } from './corroboration';
import { evaluatePublishingPolicy } from './publishing-policy';
import { GroundedDeterministicStorySynthesizer } from './synthesis';
import type { ContentCandidate, RegisteredSource, StoryRecord } from './types';
import { findCandidateStory } from './clustering';

const source = (
  id: string,
  name: string,
  url: string,
  tier: 'A' | 'B' | 'C' = 'B',
  reliabilityScore = tier === 'A' ? 0.95 : tier === 'B' ? 0.8 : 0.6,
): RegisteredSource => ({
  id,
  name,
  sourceType: 'LOCAL_OUTLET',
  teamId: 'KC',
  leagueWide: false,
  url,
  feedUrl: null,
  fetchStrategy: 'RSS',
  pollingTier: tier,
  priority: 70,
  reliabilityScore,
  checkIntervalSeconds: 300,
  enabled: true,
  etag: null,
  lastModified: null,
  lastCheckedAt: null,
  lastSuccessfulAt: null,
  nextCheckAt: new Date(),
  failureCount: 0,
  lastError: null,
  metadata: {},
});
const candidate = (
  id: string,
  title: string,
  storyType: ContentCandidate['storyType'] = 'TRADE',
): ContentCandidate => ({
  id,
  sourceId: id,
  externalId: id,
  url: `https://example.com/${id}`,
  title,
  normalizedTitle: title.toLowerCase(),
  author: null,
  publishedAt: '2026-09-03T12:00:00Z',
  discoveredAt: '2026-09-03T12:01:00Z',
  text: title,
  excerpt: title,
  entities: title.includes('Diego Pounds')
    ? ['Diego Pounds']
    : title.includes('Josh Simmons')
      ? ['Josh Simmons']
      : ['Kansas City Chiefs'],
  candidateTeams: ['KC'],
  fingerprint: id,
  status: 'NEW',
  storyType,
});
const record = (headline: string, storyType: StoryRecord['storyType'] = 'TRADE'): StoryRecord => ({
  id: 'story',
  teamId: 'KC',
  storyType,
  headline,
  summary: headline,
  whatHappened: headline,
  whyItMatters: '',
  whatsNext: '',
  status: 'DEVELOPING',
  publicationState: 'REVIEW_REQUIRED',
  importanceScore: 88,
  confidenceScore: 80,
  entities: headline.includes('Diego Pounds')
    ? ['Diego Pounds']
    : headline.includes('Josh Simmons')
      ? ['Josh Simmons']
      : ['Kansas City Chiefs'],
  firstReportedAt: '2026-09-03T11:00:00Z',
  lastMeaningfulUpdateAt: '2026-09-03T11:00:00Z',
  version: 1,
});

test('same-publisher Tier 2 items merge but count as one independent source', () => {
  const evidence = [
    {
      candidate: candidate('a', 'Chiefs acquire Diego Pounds in trade'),
      source: source('AA_WEB', 'Arrowhead Addict', 'https://arrowheadaddict.com'),
    },
    {
      candidate: candidate('b', 'Chiefs trade exposes offensive line concern for Diego Pounds'),
      source: source('AA_X', 'Arrowhead Addict X', 'https://arrowheadaddict.com'),
    },
  ];
  assert.deepEqual(evidenceCounts(evidence), {
    sourceItemCount: 2,
    publisherCount: 1,
    independentSourceCount: 1,
  });
});

test('two independent Tier 2 publishers can publish one factual event', async () => {
  const evidence = [
    {
      candidate: candidate('a', 'Chiefs acquire Diego Pounds in trade'),
      source: source('AA', 'Arrowhead Addict', 'https://arrowheadaddict.com'),
    },
    {
      candidate: candidate('b', 'Kansas City trades for Diego Pounds'),
      source: source('AP', 'Arrowhead Pride', 'https://arrowheadpride.com'),
    },
  ];
  const story = await new GroundedDeterministicStorySynthesizer().synthesize({
    existingStory: null,
    evidence,
  });
  assert.equal(story.confidenceScore, 92);
  assert.equal(
    evaluatePublishingPolicy({ story, storyType: 'TRADE', evidence }).action,
    'AUTO_PUBLISH',
  );
});

test('single Tier 1 factual trade and injury can publish immediately', async () => {
  for (const type of ['TRADE', 'INJURY'] as const) {
    const evidence = [
      {
        candidate: candidate('tier1', `Josh Simmons ${type.toLowerCase()} update`, type),
        source: source('RAPOPORT_X', 'Ian Rapoport X', 'https://x.com/RapSheet', 'A'),
      },
    ];
    const story = await new GroundedDeterministicStorySynthesizer().synthesize({
      existingStory: null,
      evidence,
    });
    assert.equal(
      evaluatePublishingPolicy({ story, storyType: type, evidence }).action,
      'AUTO_PUBLISH',
    );
  }
});

test('corroborated lower-scoring Tier 2 sources clear the tuned threshold', async () => {
  const evidence = [
    {
      candidate: candidate('a', 'Chiefs acquire Diego Pounds in trade'),
      source: source('AA', 'Arrowhead Addict', 'https://arrowheadaddict.com', 'B', 0.72),
    },
    {
      candidate: candidate('b', 'Kansas City trades for Diego Pounds'),
      source: source('LOCAL', 'Chiefs Wire', 'https://chiefswire.example', 'B', 0.72),
    },
  ];
  const story = await new GroundedDeterministicStorySynthesizer().synthesize({
    existingStory: null,
    evidence,
  });
  assert.equal(story.confidenceScore, 84);
  assert.equal(
    evaluatePublishingPolicy({ story, storyType: 'TRADE', evidence }).action,
    'AUTO_PUBLISH',
  );
});

test('Tier 3 does not count as independent corroboration but can publish in all-tier mode', async () => {
  const evidence = [
    {
      candidate: candidate('a', 'Chiefs acquire Diego Pounds in trade'),
      source: source('AA', 'Arrowhead Addict', 'https://arrowheadaddict.com'),
    },
    {
      candidate: candidate('b', 'Kansas City trades for Diego Pounds'),
      source: source('PFR', 'Pro Football Rumors', 'https://profootballrumors.com', 'C'),
    },
  ];
  const story = await new GroundedDeterministicStorySynthesizer().synthesize({
    existingStory: null,
    evidence,
  });
  assert.equal(evidenceCounts(evidence).independentSourceCount, 1);
  assert.equal(
    evaluatePublishingPolicy({ story, storyType: 'TRADE', evidence }).action,
    'AUTO_PUBLISH',
  );
});

test('single Tier 3 concrete factual report publishes in all-tier mode', async () => {
  const evidence = [
    {
      candidate: candidate('pfr', 'Chiefs restructure Trey Smith contract', 'CONTRACT'),
      source: source('PFR', 'Pro Football Rumors', 'https://profootballrumors.com', 'C'),
    },
  ];
  const story = await new GroundedDeterministicStorySynthesizer().synthesize({
    existingStory: null,
    evidence,
  });
  assert.equal(
    evaluatePublishingPolicy({ story, storyType: 'CONTRACT', evidence }).action,
    'AUTO_PUBLISH',
  );
});

test('approved editorial source publishes analysis while preserving its source title', async () => {
  const approved = source('AP', 'Arrowhead Pride', 'https://arrowheadpride.com');
  approved.metadata.publishAll = true;
  const evidence = [
    {
      candidate: candidate(
        'ap-analysis',
        'Can the Chiefs establish a superpower this season?',
        'ANALYSIS',
      ),
      source: approved,
    },
  ];
  const story = await new GroundedDeterministicStorySynthesizer().synthesize({
    existingStory: null,
    evidence,
  });
  assert.equal(story.headline, evidence[0].candidate.title);
  assert.equal(
    evaluatePublishingPolicy({ story, storyType: 'ANALYSIS', evidence }).action,
    'AUTO_PUBLISH',
  );
});

test('different headlines describing the Diego Pounds trade cluster', () => {
  const result = findCandidateStory(
    candidate('b', 'Chiefs trade makes offensive line concern clear for Diego Pounds'),
    [record('Chiefs acquire Diego Pounds to strengthen offensive tackle depth')],
  );
  assert.equal(result.storyId, 'story');
  assert.equal(result.ambiguous, false);
});

test('same player but different factual event does not merge', () => {
  const result = findCandidateStory(candidate('b', 'Chiefs release Josh Simmons', 'RELEASE'), [
    record('Josh Simmons receives injury update', 'INJURY'),
  ]);
  assert.equal(result.storyId, undefined);
});

test('similar analysis topics do not auto-merge', () => {
  const result = findCandidateStory(
    candidate('b', 'Chiefs receivers still have major questions', 'ANALYSIS'),
    [record('Chiefs wide receiver room is a disaster', 'ANALYSIS')],
  );
  assert.equal(result.storyId, undefined);
});

test('evolving Josh Simmons injury updates cluster', () => {
  const result = findCandidateStory(
    candidate('b', 'Josh Simmons injury update leaves Chiefs with questions', 'INJURY'),
    [record('Andy Reid Josh Simmons injury update brings an uncomfortable wait', 'INJURY')],
  );
  assert.equal(result.storyId, 'story');
});

test('materially conflicting reports require review', async () => {
  const evidence = [
    {
      candidate: candidate('a', 'Chiefs rule Josh Simmons OUT', 'INJURY'),
      source: source('AA', 'Arrowhead Addict', 'https://arrowheadaddict.com'),
    },
    {
      candidate: candidate('b', 'Josh Simmons is QUESTIONABLE and expected to play', 'INJURY'),
      source: source('AP', 'Arrowhead Pride', 'https://arrowheadpride.com'),
    },
  ];
  const story = await new GroundedDeterministicStorySynthesizer().synthesize({
    existingStory: null,
    evidence,
  });
  assert.equal(
    evaluatePublishingPolicy({ story, storyType: 'INJURY', evidence }).action,
    'REVIEW_REQUIRED',
  );
});

test('misclassified list and reaction coverage does not auto-publish as a factual event', async () => {
  const evidence = [
    {
      candidate: candidate(
        'a',
        '5 Chiefs underdogs who beat the odds to crash the roster',
        'ROSTER',
      ),
      source: source('AA', 'Arrowhead Addict', 'https://arrowheadaddict.com'),
    },
    {
      candidate: candidate('b', 'Chiefs roster winners and losers after final cuts', 'ROSTER'),
      source: source('AP', 'Arrowhead Pride', 'https://arrowheadpride.com'),
    },
  ];
  const story = await new GroundedDeterministicStorySynthesizer().synthesize({
    existingStory: null,
    evidence,
  });
  assert.equal(
    evaluatePublishingPolicy({ story, storyType: 'ROSTER', evidence }).action,
    'REVIEW_REQUIRED',
  );
});
