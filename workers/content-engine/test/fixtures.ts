import type { Candidate, Source, Story, Video } from '../src/types';
import type { TeamId } from '../src/teams';
export const NOW = 1_800_000_000_000;
export function source(id = 'source-1', team: TeamId | null = 'kc'): Source {
  return {
    id,
    teamId: team,
    teamIds: team ? [team] : [],
    leagueWide: team === null,
    enabled: true,
    platform: 'RSS',
    priority: 5,
    nextCheckAt: NOW,
    name: `Synthetic ${id}`,
    url: `https://publisher.invalid/${id}`,
    metadata: { synthetic: true, originalNull: null },
  };
}
export function candidate(
  id = 'candidate-1',
  sourceId = 'source-1',
  team: TeamId = 'kc',
): Candidate {
  return {
    id,
    sourceId,
    externalId: id,
    canonicalUrl: `https://publisher.invalid/article/${id}`,
    fingerprint: 'same-independent-report',
    status: 'NEW',
    publishedAt: NOW,
    discoveredAt: NOW,
    teamIds: [team],
    title: `Synthetic ${id}`,
    rawText: 'Synthetic evidence only. '.repeat(100),
    author: 'Synthetic Reporter',
    metadata: { retained: true, nested: [null, false, 7] },
  };
}
export function story(id = 'story-1', team: TeamId | null = 'kc', version = 1): Story {
  return {
    id,
    teamId: team,
    storyType: 'NEWS',
    publicationState: version === 1 ? 'DRAFT' : 'PUBLISHED',
    status: 'CONFIRMED',
    headline: `Synthetic ${id}`,
    summary: 'Synthetic summary.',
    importanceScore: 60,
    confidenceScore: 95,
    firstReportedAt: NOW,
    meaningfulUpdateAt: NOW,
    latestEvidenceAt: NOW,
    hotReadUntil: null,
    gameId: null,
    version,
    entityKeys: ['synthetic:player'],
    claims: [{ text: 'Synthetic verified claim', qualifier: null }],
  };
}
export function video(id = 'video-1', teamIds: TeamId[] = ['kc', 'sea']): Video {
  return {
    videoId: id,
    sourceId: 'source-1',
    publishedAt: NOW,
    metadataCheckedAt: NOW,
    availability: 'PUBLIC',
    teamIds,
    title: 'Synthetic Film Room clip',
    description: 'Synthetic metadata, no fetched video.',
    viewCount: null,
    thumbnails: { default: 'https://images.invalid/clip.jpg' },
    duration: 'PT2M3S',
  };
}
export async function publishFixture(
  repo: import('../src/repository').EditorialRepository,
  id: string,
  team: TeamId | null = 'kc',
  time = NOW,
) {
  const c = candidate(`candidate-${id}`);
  c.teamIds = team ? [team] : [];
  await repo.insertCandidate(c);
  const s = story(id, team);
  s.meaningfulUpdateAt = time;
  await repo.createStory(s);
  const e = {
    id: `evidence-${id}`,
    storyId: id,
    candidateId: c.id,
    sourceId: c.sourceId,
    firstSeenAt: time,
  };
  await repo.associateEvidence(e);
  await repo.publishStory({ ...s, version: 2, publicationState: 'PUBLISHED' }, 1, {
    decision: { allowed: true, reason: 'Synthetic fixture' },
    card: { kind: 'news', title: s.headline },
    evidenceIds: [e.id],
    eventId: `event-${id}`,
  });
  return { ...s, version: 2, publicationState: 'PUBLISHED' as const };
}
