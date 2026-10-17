import assert from 'node:assert/strict';
import test from 'node:test';
import { RssSourceFetcher } from './fetcher';
import { parseRssOrAtom } from '@/features/story-engine/rss';
import { publisherKey, evidenceCounts } from '@/features/story-engine/corroboration';
import { findCandidateStory } from '@/features/story-engine/clustering';
import { normalizeRawItem } from '@/features/story-engine/normalization';
import { GroundedDeterministicStorySynthesizer } from '@/features/story-engine/synthesis';
import type { RegisteredSource, StoryRecord } from '@/features/story-engine/types';

const source: RegisteredSource = {
  id: 'source',
  name: 'Example publisher',
  url: 'https://news.example',
  feedUrl: 'https://news.example/rss',
  sourceType: 'LOCAL_OUTLET',
  teamId: 'BUF',
  leagueWide: false,
  fetchStrategy: 'RSS',
  pollingTier: 'B',
  priority: 70,
  reliabilityScore: 0.7,
  checkIntervalSeconds: 600,
  enabled: true,
  etag: '"old"',
  lastModified: 'Wed, 14 Oct 2026 00:00:00 GMT',
  lastCheckedAt: null,
  lastSuccessfulAt: null,
  nextCheckAt: new Date(),
  failureCount: 0,
  lastError: null,
  metadata: {},
};
const xml =
  '<rss><channel><item><title>Bills practice update</title><link>https://news.example/a?utm_source=feed</link><pubDate>2026-10-16T12:00:00Z</pubDate><author>Original Reporter</author><description>Coaches discussed the available personnel and outlined changes to practice. This is a sufficiently long permitted test excerpt.</description></item></channel></rss>';

test('conditional 304 preserves validators and produces no candidates', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    assert.equal((init?.headers as Record<string, string>)['If-None-Match'], '"old"');
    assert.equal(
      (init?.headers as Record<string, string>)['If-Modified-Since'],
      source.lastModified,
    );
    return new Response(null, { status: 304 });
  };
  try {
    assert.deepEqual(await new RssSourceFetcher().fetch(source), {
      items: [],
      notModified: true,
      etag: '"old"',
      lastModified: source.lastModified,
    });
  } finally {
    globalThis.fetch = original;
  }
});
test('disallowed redirect is rejected before requesting its target', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/private' } });
  };
  try {
    await assert.rejects(new RssSourceFetcher().fetch(source), /Private|allowlisted/);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = original;
  }
});
test('same-host redirect retains attribution and canonical article identity', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () =>
    ++calls === 1
      ? new Response(null, { status: 301, headers: { location: '/feed' } })
      : new Response(xml, { headers: { etag: '"new"' } });
  try {
    const result = await new RssSourceFetcher().fetch(source);
    assert.equal(calls, 2);
    assert.equal(result.etag, '"new"');
    const candidate = normalizeRawItem(result.items[0], source);
    assert.equal(candidate.author, 'Original Reporter');
    assert.equal(candidate.sourceId, 'source');
    assert.equal(candidate.url, 'https://news.example/a');
    assert.deepEqual(candidate.candidateTeams, ['BUF']);
  } finally {
    globalThis.fetch = original;
  }
});
test('HTTP failure, invalid RSS, and oversized response fail instead of recording empty success', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response('blocked', { status: 403 });
    await assert.rejects(new RssSourceFetcher().fetch(source), /HTTP 403/);
    globalThis.fetch = async () => new Response('<html>Login</html>');
    await assert.rejects(new RssSourceFetcher().fetch(source), /Invalid/);
    globalThis.fetch = async () => new Response('x'.repeat(1_048_577));
    await assert.rejects(new RssSourceFetcher().fetch(source), /exceeds/);
  } finally {
    globalThis.fetch = original;
  }
});
test('fetch timeout aborts an unavailable source', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (_url, init) =>
    new Promise((_resolve, reject) => {
      init!.signal!.addEventListener('abort', () => reject(new Error('Timed out')), { once: true });
    });
  try {
    await assert.rejects(new RssSourceFetcher().fetch(source), /Timed out/);
  } finally {
    globalThis.fetch = original;
  }
});
test('invalid item date or unsafe article URL cannot poison the feed batch', () => {
  assert.throws(() => parseRssOrAtom('<!DOCTYPE rss><rss/>', source));
  assert.throws(() => parseRssOrAtom('<rss><channel><item></channel></rss>', source), /Incomplete/);
  assert.deepEqual(parseRssOrAtom('<feed/>', source), []);
  assert.deepEqual(
    parseRssOrAtom(
      '<rss><channel><item><title>Bad</title><link>javascript:alert(1)</link></item></channel></rss>',
      source,
    ),
    [],
  );
  assert.deepEqual(parseRssOrAtom(xml.replace('2026-10-16T12:00:00Z', 'not-a-date'), source), []);
});
test('same publication aliases do not manufacture independent corroboration', () => {
  const alias = { ...source, id: 'COMPLETELY_DIFFERENT_RSS', url: 'http://www.news.example/rss' };
  assert.equal(publisherKey(source), publisherKey(alias));
  const candidate = normalizeRawItem(parseRssOrAtom(xml, source)[0], source);
  assert.equal(
    evidenceCounts([
      { source, candidate },
      { source: alias, candidate },
    ]).independentSourceCount,
    1,
  );
  assert.notEqual(
    publisherKey({ ...source, url: 'https://x.com/reporterA' }),
    publisherKey({ ...source, url: 'https://x.com/reporterB' }),
  );
  assert.equal(
    publisherKey({ ...source, id: 'ARROWHEAD_ADDICT_X', url: 'https://x.com/ArrowheadAddict' }),
    publisherKey({ ...source, id: 'ARROWHEAD_ADDICT_WEB', url: 'https://arrowheadaddict.com/' }),
  );
});
test('identical syndicated title and excerpt consolidate while attribution remains intact', () => {
  const candidate = normalizeRawItem(parseRssOrAtom(xml, source)[0], source);
  const story = {
    id: 'saved-story-id',
    teamId: 'BUF',
    storyType: candidate.storyType,
    headline: candidate.title,
    summary: candidate.text,
    whatHappened: candidate.text,
    entities: [],
    lastMeaningfulUpdateAt: candidate.publishedAt,
    whyItMatters: '',
    whatsNext: '',
    status: 'DEVELOPING',
    publicationState: 'REVIEW_REQUIRED',
    importanceScore: 70,
    confidenceScore: 70,
    firstReportedAt: candidate.publishedAt,
    version: 1,
  } satisfies StoryRecord;
  candidate.entities = [];
  assert.equal(findCandidateStory(candidate, [story]).storyId, 'saved-story-id');
  assert.equal(
    findCandidateStory({ ...candidate, text: '', excerpt: '' }, [story]).ambiguous,
    true,
  );
  assert.equal(
    findCandidateStory({ ...candidate, candidateTeams: ['MIA'] }, [story]).storyId,
    undefined,
  );
  assert.equal(candidate.author, 'Original Reporter');
});

test('headline-only evidence cannot generate factual editorial copy', async () => {
  const candidate = normalizeRawItem(parseRssOrAtom(xml, source)[0], source);
  const synthesizer = new GroundedDeterministicStorySynthesizer();
  await assert.rejects(
    synthesizer.synthesize({
      existingStory: null,
      evidence: [{ source, candidate: { ...candidate, text: '', excerpt: '' } }],
    }),
    /beyond a headline/,
  );
});
