import type { SearchResponse, SearchResult } from '@/features/search/types';
import { reciprocalRankFusion } from '@/server/search/core';
import { searchDb } from '@/server/search/database';
import { BgeHttpEmbeddingProvider, OllamaAnswerProvider } from '@/server/search/providers';

const asResult = (row: any, score: number): SearchResult => ({
  id: row.parent_id,
  teamId: row.team_id,
  type: row.result_type,
  title: row.title,
  summary: row.summary,
  url: row.url,
  sourceName: row.source_name,
  sourceUrl: row.source_url,
  publishedAt: row.published_at?.toISOString?.() ?? row.published_at ?? null,
  updatedAt: row.source_updated_at?.toISOString?.() ?? row.source_updated_at,
  image: row.image_url,
  score,
  canonicalStoryId: row.canonical_story_id,
  metadata: row.metadata ?? {},
});

export async function hybridSearch({
  query,
  teamId,
  limit = 12,
  includeAnswer = false,
}: {
  query: string;
  teamId: string;
  limit?: number;
  includeAnswer?: boolean;
}): Promise<SearchResponse> {
  const started = Date.now();
  const sql = searchDb();
  const lexicalStarted = Date.now();
  const lexical = await sql`SELECT * FROM (
    SELECT DISTINCT ON (source_type,source_id)
      source_type || ':' || source_id AS parent_id,*,ts_rank_cd(search_vector,websearch_to_tsquery('english',${query})) AS rank
    FROM search_documents WHERE active=true AND (team_id=${teamId} OR team_id IS NULL)
      AND search_vector @@ websearch_to_tsquery('english',${query})
    ORDER BY source_type,source_id,rank DESC
  ) ranked ORDER BY rank DESC LIMIT 50`;
  const lexicalMs = Date.now() - lexicalStarted;
  let vector: any[] = [];
  let vectorMs: number | null = null;
  try {
    const vectorStarted = Date.now();
    const embedding = await new BgeHttpEmbeddingProvider().embedQuery(query);
    const serialized = JSON.stringify(embedding);
    vector = await sql`SELECT * FROM (
      SELECT DISTINCT ON (source_type,source_id)
        source_type || ':' || source_id AS parent_id,*,embedding <=> ${serialized}::vector AS distance
      FROM search_documents WHERE active=true AND embedding IS NOT NULL AND (team_id=${teamId} OR team_id IS NULL)
      ORDER BY source_type,source_id,distance
    ) ranked ORDER BY distance LIMIT 50`;
    vectorMs = Date.now() - vectorStarted;
  } catch (error) {
    console.warn('[search] semantic retrieval unavailable; using lexical results', error);
  }

  const fused = reciprocalRankFusion([
    lexical.sort((a, b) => Number(b.rank) - Number(a.rank)).map((row) => row.parent_id),
    vector.sort((a, b) => Number(a.distance) - Number(b.distance)).map((row) => row.parent_id),
  ]);
  const byId = new Map([...lexical, ...vector].map((row) => [row.parent_id, row]));
  const results = fused.slice(0, limit).map(([id, score]) => asResult(byId.get(id), score));
  let answer: string | undefined;
  let answerMs: number | null = null;
  if (includeAnswer && results.length) {
    try {
      const answerStarted = Date.now();
      answer = await new OllamaAnswerProvider().answer(
        query,
        results.slice(0, 6).map((result) => ({
          id: result.id,
          title: result.title,
          content: `${result.summary}\n${byId.get(result.id)?.content ?? ''}`,
        })),
      );
      answerMs = Date.now() - answerStarted;
    } catch (error) {
      console.warn('[search] grounded answer unavailable; returning results only', error);
    }
  }
  const response: SearchResponse = {
    query,
    ...(answer ? { answer } : {}),
    results,
    sources: results.map((result) => ({ id: result.id, title: result.title, url: result.url })),
    timing: { totalMs: Date.now() - started, lexicalMs, vectorMs, answerMs },
  };
  console.info(
    JSON.stringify({ metric: 'search_complete', resultCount: results.length, ...response.timing }),
  );
  return response;
}
