import assert from 'node:assert/strict';
import test from 'node:test';
import { TEAM_LIST } from '@/data/teams';
import { getAllSources, getSourcesForTeam } from '@/data/sources';
import { SOURCE_RESEARCH, getResearchedSourcesForTeam, RESEARCH_SOURCE_ADDITIONS } from './index';
import {
  canAutomateSource,
  normalizeSourceUrl,
  sourceIdentity,
  qualityScore,
  plannedIntervalSeconds,
  sharedFeedPlan,
} from './policy';
import { sourceExpansionModel } from './cost-model';
import summary from '../../../../reports/source-expansion/summary.json';
import originalCatalog from '../../../../reports/source-expansion/existing.json';

test('every NFL team has researched primary links and an honest minimum-20 gap', () => {
  assert.equal(TEAM_LIST.length, 32);
  for (const team of TEAM_LIST) {
    const sources = getResearchedSourcesForTeam(team.abbr);
    assert.ok(sources.length > 0, team.abbr);
    for (const source of sources) assert.ok(source.url.startsWith('https://'));
    const qualified = sources.filter((source) => source.qualified);
    // This audit records a release blocker; it does not manufacture entries to pass it.
    const reported = summary.teams.find((row) => row.team === team.abbr)!;
    assert.equal(reported.qualified, qualified.length);
    assert.equal(reported.qualifiedGap, Math.max(0, 20 - qualified.length));
  }
});
test('source IDs, publication identities and team associations are unique', () => {
  const { sources, teamSources } = SOURCE_RESEARCH;
  assert.equal(new Set(sources.map((s) => s.id)).size, sources.length);
  assert.equal(new Set(sources.map((s) => normalizeSourceUrl(s.url))).size, sources.length);
  assert.equal(
    new Set(teamSources.map((s) => `${s.sourceId}/${s.teamId}`)).size,
    teamSources.length,
  );
  const ids = new Set(sources.map((s) => s.id));
  for (const link of teamSources) assert.ok(ids.has(link.sourceId));
});

test('existing general source IDs and configuration remain byte-for-byte equivalent', () => {
  const current = getAllSources();
  assert.equal(new Set(current.map((s) => s.id)).size, current.length);
  for (const original of originalCatalog.general)
    assert.deepEqual(
      JSON.parse(JSON.stringify(current.find((s) => s.id === original.id))),
      original,
    );
  assert.ok(RESEARCH_SOURCE_ADDITIONS.every((source) => !source.enabled));
});
test('new shared publications are stored once and appear only on their associated teams', () => {
  const shared = RESEARCH_SOURCE_ADDITIONS.find((s) => (s.teamIds?.length ?? 0) > 1)!;
  assert.ok(shared);
  assert.equal(getAllSources().filter((s) => s.id === shared.id).length, 1);
  for (const team of TEAM_LIST)
    assert.equal(
      getSourcesForTeam(team.abbr).some((s) => s.id === shared.id),
      shared.teamIds!.includes(team.abbr),
    );
});
test('normalization handles protocol, www, tracking, aliases and exact social identities', () => {
  assert.equal(
    normalizeSourceUrl('http://WWW.Example.com/?utm_source=a#top'),
    'https://example.com',
  );
  assert.equal(
    normalizeSourceUrl('https://twitter.com/Ben_Baby/with_replies'),
    'https://x.com/ben_baby',
  );
  assert.notEqual(
    sourceIdentity('https://shared.example/publication-a'),
    sourceIdentity('https://shared.example/publication-b'),
  );
  const aliases = new Map([['https://example.com/rss', 'https://example.com']]);
  assert.equal(sourceIdentity('http://www.example.com/rss', aliases), 'https://example.com');
  assert.throws(() => normalizeSourceUrl('file:///secret'));
});
test('scores have bounded components and do not become publishing trust scores', () => {
  for (const source of SOURCE_RESEARCH.sources)
    assert.equal(qualityScore(source.qualityEvidence), source.qualityScore);
  for (const source of RESEARCH_SOURCE_ADDITIONS) assert.equal(source.trustScore, 0);
  assert.throws(() =>
    qualityScore({
      originalReporting: 26,
      reliability: 0,
      teamRelevance: 0,
      freshness: 0,
      uniqueness: 0,
      accessibility: 0,
    }),
  );
});
test('verified RSS alone never authorizes ingestion; X stays discovery-only', () => {
  const base = {
    discoveryOnly: false,
    verificationStatus: 'FEED_VERIFIED',
    canonicalFeedUrl: 'https://example.com/feed',
    rightsStatus: 'REVIEW_REQUIRED' as const,
  };
  assert.equal(canAutomateSource(base), false);
  assert.equal(canAutomateSource({ ...base, rightsStatus: 'APPROVED_METADATA' }), true);
  assert.equal(
    canAutomateSource({ ...base, rightsStatus: 'APPROVED_METADATA', discoveryOnly: true }),
    false,
  );
  for (const source of SOURCE_RESEARCH.sources) {
    assert.equal(source.enabled, false);
    assert.equal(source.ingestionEligible, false);
    if (source.type === 'X') assert.equal(source.discoveryOnly, true);
  }
  assert.equal(sharedFeedPlan(SOURCE_RESEARCH.sources).size, 0);
});
test('shared feed plan deduplicates approved fetches while preserving association records', () => {
  const feeds = sharedFeedPlan([
    { canonicalFeedUrl: 'http://www.example.com/rss', enabled: true, ingestionEligible: true },
    { canonicalFeedUrl: 'https://example.com/rss', enabled: true, ingestionEligible: true },
    { canonicalFeedUrl: 'https://example.com/disabled', enabled: false, ingestionEligible: true },
  ]);
  assert.equal(feeds.size, 1);
  assert.equal([...feeds.values()][0].length, 2);
});
test('adaptive planning requires measured volume and backs off failures', () => {
  assert.equal(
    plannedIntervalSeconds({ averageDailyItems: null, consecutiveFailures: 0, tier: 1 }),
    null,
  );
  const base = { averageDailyItems: 24, consecutiveFailures: 0, tier: 1 };
  assert.ok(
    plannedIntervalSeconds({ ...base, consecutiveFailures: 3 })! > plannedIntervalSeconds(base)!,
  );
});
test('storage and account-wide write/request gates fail when modeled expansion exceeds capacity', () => {
  const launch = sourceExpansionModel({
    dau: 1000,
    feeds: 160,
    checksPerFeedPerDay: 8,
    uniqueCandidatesPerDay: 400,
  });
  assert.ok(launch.d1Mb[365] > 500);
  assert.equal(launch.projectedMonthlyCostUsd, null);
  const high = sourceExpansionModel({
    dau: 5000,
    feeds: 160,
    checksPerFeedPerDay: 8,
    uniqueCandidatesPerDay: 1000,
  });
  assert.equal(high.limits.workerRequests, false);
  assert.equal(high.limits.d1Writes, false);
  assert.equal(high.accountUsageVerified, false);
  assert.equal(high.workerCpuMs, null);
});
