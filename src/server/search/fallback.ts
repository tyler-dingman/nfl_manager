import type { SearchResponse, SearchResult } from '@/features/search/types';
import { NFL_LEAGUE_DATA } from '@/server/data/nfl-data';
import { loadTeamBriefings } from '@/server/content/team-briefings';
import { listPublicStories } from '@/server/story-engine/projections';
import { buildDeterministicSearchAnswer } from './deterministic-answer';

const searchTerms = (query: string) =>
  query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(
      (term) => term.length > 1 && !['the', 'and', 'for', 'about', 'what', 'when'].includes(term),
    );

const relevance = (query: string, value: string) => {
  const normalized = value.toLowerCase();
  const terms = searchTerms(query);
  if (!terms.length) return 0;
  return (
    terms.reduce((score, term) => score + (normalized.includes(term) ? 1 : 0), 0) / terms.length
  );
};

export async function fallbackTeamSearch(input: {
  query: string;
  teamId: string;
  limit: number;
  includeAnswer: boolean;
}): Promise<SearchResponse> {
  const started = Date.now();
  const [canonicalResult, briefingResult] = await Promise.allSettled([
    listPublicStories(input.teamId, 50),
    loadTeamBriefings(input.teamId),
  ]);
  const canonical = canonicalResult.status === 'fulfilled' ? canonicalResult.value : [];
  const briefings = briefingResult.status === 'fulfilled' ? briefingResult.value : [];
  const known = new Set<string>();
  const candidates: SearchResult[] = [];

  for (const story of canonical) {
    const score = relevance(
      input.query,
      `${story.headline} ${story.shortSummary} ${story.whatHappened ?? ''} ${story.whyItMatters ?? ''}`,
    );
    if (!score) continue;
    known.add(story.id);
    candidates.push({
      id: story.id,
      teamId: story.teamId,
      type: 'story',
      title: story.headline,
      summary: story.shortSummary || story.whatHappened || '',
      url: `/content/${encodeURIComponent(story.id)}`,
      sourceName: story.primarySource?.name ?? story.sources[0]?.name ?? null,
      sourceUrl: story.primarySource?.url ?? story.sources[0]?.url ?? null,
      publishedAt: story.sources[0]?.publishedAt ?? null,
      updatedAt: story.lastMeaningfulUpdateAt,
      image: null,
      score,
      canonicalStoryId: story.id,
      metadata: { fallback: true },
    });
  }

  for (const briefing of briefings) {
    if (known.has(briefing.id)) continue;
    const score = relevance(
      input.query,
      `${briefing.headline} ${briefing.summary} ${briefing.category} ${briefing.whyItMatters ?? ''}`,
    );
    if (!score) continue;
    candidates.push({
      id: briefing.id,
      teamId: briefing.teamAbbr,
      type: 'article',
      title: briefing.headline,
      summary: briefing.summary,
      url: `/content/${encodeURIComponent(briefing.id)}`,
      sourceName: briefing.sources[0]?.publisher ?? null,
      sourceUrl: briefing.sources[0]?.url ?? null,
      publishedAt: briefing.sources[0]?.publishedAt ?? null,
      updatedAt: briefing.updatedAt,
      image: briefing.imageUrl ?? null,
      score,
      canonicalStoryId: briefing.id,
      metadata: { fallback: true },
    });
  }

  for (const player of NFL_LEAGUE_DATA.players.filter(
    (candidate) => candidate.teamAbbr.toUpperCase() === input.teamId,
  )) {
    const score = relevance(input.query, `${player.name} ${player.position} ${player.teamAbbr}`);
    if (!score) continue;
    candidates.push({
      id: player.id,
      teamId: input.teamId,
      type: 'player',
      title: player.name,
      summary: `${player.position} · ${input.teamId}`,
      url: `/roster?team=${encodeURIComponent(input.teamId)}&player=${encodeURIComponent(player.id)}`,
      sourceName: 'Down & Distance roster',
      sourceUrl: null,
      publishedAt: null,
      updatedAt: new Date(0).toISOString(),
      image: player.headshotUrl ?? null,
      score,
      canonicalStoryId: null,
      metadata: { fallback: true },
    });
  }

  const results = candidates
    .sort(
      (left, right) =>
        right.score - left.score ||
        new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
    )
    .slice(0, input.limit);
  return {
    query: input.query,
    ...(input.includeAnswer
      ? { answer: buildDeterministicSearchAnswer(input.query, results) }
      : {}),
    results,
    sources: results.map((result) => ({ id: result.id, title: result.title, url: result.url })),
    timing: { totalMs: Date.now() - started, lexicalMs: 0, vectorMs: null, answerMs: 0 },
  };
}
