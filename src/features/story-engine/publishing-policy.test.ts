import assert from 'node:assert/strict';
import test from 'node:test';
import {
  pollingIntervalSeconds,
  registeredSourceIntervalSeconds,
  SOURCE_POLLING_TIERS,
} from './config';
import { evaluatePublishingPolicy } from './publishing-policy';
import type { ContentCandidate, RegisteredSource, SynthesizedStory } from './types';
const source = (id: string, type = 'OFFICIAL_TEAM', reliabilityScore = 1): RegisteredSource => ({
  id,
  name: id,
  sourceType: type,
  teamId: 'KC',
  leagueWide: false,
  url: `https://${id}.example`,
  feedUrl: null,
  fetchStrategy: 'FIXTURE',
  pollingTier: 'A',
  priority: 100,
  reliabilityScore,
  checkIntervalSeconds: 180,
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
const candidate = (id: string, text: string): ContentCandidate => ({
  id,
  sourceId: 'official',
  externalId: id,
  url: `https://official.example/${id}`,
  title: text,
  normalizedTitle: text.toLowerCase(),
  author: null,
  publishedAt: '2026-08-31T10:00:00Z',
  discoveredAt: '2026-08-31T10:00:00Z',
  text,
  excerpt: text,
  entities: [],
  candidateTeams: ['KC'],
  fingerprint: id,
  status: 'NEW',
  storyType: 'TRADE',
});
const story = (text = 'Chiefs officially acquire offensive tackle'): SynthesizedStory => ({
  headline: text,
  summary: 'The team announced the completed transaction.',
  whatHappened: 'The team announced the completed transaction.',
  whyItMatters: 'Adds roster depth.',
  whatsNext: '',
  status: 'DEVELOPING',
  importanceScore: 92,
  confidenceScore: 98,
  claims: [
    {
      text: 'The team announced the completed transaction.',
      sourceEvidenceIds: ['one'],
      confidence: 1,
    },
  ],
});
test('official high-confidence factual story auto-publishes and can break', () => {
  const c = candidate('one', 'Chiefs officially acquire offensive tackle');
  const result = evaluatePublishingPolicy({
    story: story(),
    storyType: 'TRADE',
    evidence: [{ candidate: c, source: source('official') }],
  });
  assert.equal(result.action, 'AUTO_PUBLISH');
  assert.equal(result.breaking, true);
});
test('rumors and conflicts require review', () => {
  const c = candidate('one', 'Chiefs might trade for a tackle');
  assert.equal(
    evaluatePublishingPolicy({
      story: story(c.title),
      storyType: 'TRADE',
      evidence: [{ candidate: c, source: source('reporter', 'NATIONAL_REPORTER', 0.95) }],
    }).action,
    'REVIEW_REQUIRED',
  );
  assert.equal(
    evaluatePublishingPolicy({
      story: story(),
      storyType: 'TRADE',
      evidence: [{ candidate: c, source: source('official'), supportType: 'CONTRADICTS' }],
    }).action,
    'REVIEW_REQUIRED',
  );
});
test('unsupported content is not published and editor overrides win', () => {
  assert.equal(
    evaluatePublishingPolicy({
      story: { ...story(), confidenceScore: 40 },
      storyType: 'TRADE',
      evidence: [],
    }).action,
    'DO_NOT_PUBLISH',
  );
  const c = candidate('one', 'Chiefs announce trade');
  assert.equal(
    evaluatePublishingPolicy({
      story: story(),
      storyType: 'TRADE',
      evidence: [{ candidate: c, source: source('official') }],
      override: 'HIDE',
    }).action,
    'DO_NOT_PUBLISH',
  );
  assert.equal(
    evaluatePublishingPolicy({
      story: story(),
      storyType: 'TRADE',
      evidence: [{ candidate: c, source: source('official') }],
      override: 'FORCE_REVIEW',
    }).action,
    'REVIEW_REQUIRED',
  );
});
test('named polling tiers and per-source overrides use expected intervals', () => {
  assert.deepEqual(SOURCE_POLLING_TIERS, { BREAKING: 180, STANDARD: 600, LONG_FORM: 1800 });
  assert.equal(pollingIntervalSeconds('STANDARD'), 600);
  assert.equal(pollingIntervalSeconds('STANDARD', 240), 240);
  assert.equal(registeredSourceIntervalSeconds(source('tier-default')), 180);
  assert.equal(
    registeredSourceIntervalSeconds({ ...source('override'), checkIntervalSeconds: 240 }),
    240,
  );
});
