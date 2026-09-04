import assert from 'node:assert/strict';
import test from 'node:test';
import { nextCheckAfterFailure, nextCheckAfterSuccess } from './config';
import { parseRssOrAtom } from './rss';
import { canonicalizeUrl, normalizeRawItem } from './normalization';
import { findCandidateStory } from './clustering';
import { evaluateMaterialChange } from './material-change';
import type { RegisteredSource, StoryRecord } from './types';

const source: RegisteredSource = {
  id: 'KC',
  name: 'Chiefs',
  sourceType: 'OFFICIAL_TEAM',
  teamId: 'KC',
  leagueWide: false,
  url: 'https://chiefs.example',
  feedUrl: 'https://chiefs.example/rss',
  fetchStrategy: 'RSS',
  pollingTier: 'A',
  priority: 100,
  reliabilityScore: 1,
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
};
test('scheduling uses interval and bounded exponential backoff', () => {
  const now = new Date('2026-01-01T00:00:00Z');
  assert.equal(nextCheckAfterSuccess(180, now).toISOString(), '2026-01-01T00:03:00.000Z');
  assert.equal(nextCheckAfterFailure(180, 2, now).toISOString(), '2026-01-01T00:12:00.000Z');
  assert.equal(nextCheckAfterFailure(180, 99, now).toISOString(), '2026-01-01T06:00:00.000Z');
});
test('RSS parser and normalizer produce stable candidates', () => {
  const xml = `<rss><channel><item><guid>a1</guid><title>Chiefs trade for a tackle</title><link>https://chiefs.example/a?utm_source=x</link><pubDate>Sun, 31 Aug 2026 14:00:00 GMT</pubDate><description>Patrick Example joins Kansas City Chiefs.</description></item></channel></rss>`;
  const [item] = parseRssOrAtom(xml, source);
  const candidate = normalizeRawItem(item, source);
  assert.equal(candidate.externalId, 'a1');
  assert.equal(candidate.storyType, 'TRADE');
  assert.deepEqual(candidate.candidateTeams, ['KC']);
  assert.equal(candidate.url, 'https://chiefs.example/a');
  assert.equal(canonicalizeUrl('https://x.test/a?ref=y'), 'https://x.test/a');
});
test('Atom parser preserves CDATA titles and summaries', () => {
  const xml = `<feed><entry><title type="html"><![CDATA[Chiefs’ practice update]]></title><link rel="alternate" href="https://chiefs.example/practice"/><id>atom-1</id><published>2026-09-03T15:00:00-04:00</published><summary type="html"><![CDATA[<p>R Mason Thomas missed practice.</p>]]></summary></entry></feed>`;
  const [item] = parseRssOrAtom(xml, source);
  assert.equal(item.title, 'Chiefs’ practice update');
  assert.equal(item.excerpt, 'R Mason Thomas missed practice.');
});
test('clustering merges strong matches and flags the ambiguous band', () => {
  const base = normalizeRawItem(
    {
      sourceId: 'KC',
      externalId: '1',
      url: 'https://chiefs.example/1',
      title: 'Chiefs trade for veteran offensive tackle',
      author: null,
      publishedAt: '2026-08-31T14:00:00Z',
      updatedAt: null,
      rawText: 'Chiefs acquire Alex Example',
      excerpt: 'Chiefs acquire Alex Example',
      media: [],
      fetchedAt: '2026-08-31T14:00:00Z',
    },
    source,
  );
  const story: StoryRecord = {
    id: 's',
    teamId: 'KC',
    storyType: 'TRADE',
    headline: 'Chiefs trade for veteran offensive tackle',
    summary: 'Chiefs acquire Alex Example',
    whatHappened: 'Chiefs acquire Alex Example',
    whyItMatters: '',
    whatsNext: '',
    status: 'DEVELOPING',
    publicationState: 'DRAFT',
    importanceScore: 80,
    confidenceScore: 88,
    entities: base.entities,
    firstReportedAt: base.publishedAt,
    lastMeaningfulUpdateAt: base.publishedAt,
    version: 1,
  };
  assert.equal(findCandidateStory(base, [story]).storyId, 's');
});
test('official resolution is material while repeated wording is not', () => {
  const candidate = normalizeRawItem(
    {
      sourceId: 'KC',
      externalId: '1',
      url: 'https://chiefs.example/1',
      title: 'Chiefs trade is complete',
      author: null,
      publishedAt: '2026-08-31T14:00:00Z',
      updatedAt: null,
      rawText: 'The trade is final.',
      excerpt: 'The trade is final.',
      media: [],
      fetchedAt: '2026-08-31T14:00:00Z',
    },
    source,
  );
  const story: StoryRecord = {
    id: 's',
    teamId: 'KC',
    storyType: 'TRADE',
    headline: 'Chiefs consider trade',
    summary: 'Talks continue',
    whatHappened: 'Talks continue',
    whyItMatters: '',
    whatsNext: '',
    status: 'DEVELOPING',
    publicationState: 'DRAFT',
    importanceScore: 70,
    confidenceScore: 80,
    entities: [],
    firstReportedAt: candidate.publishedAt,
    lastMeaningfulUpdateAt: candidate.publishedAt,
    version: 1,
  };
  assert.equal(evaluateMaterialChange(story, candidate, true).changeType, 'RESOLUTION');
});
