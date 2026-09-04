import type { IndexDocument } from '@/features/search/types';
import { NFL_LEAGUE_DATA } from '@/server/data/nfl-data';
import { chunkText, contentHash } from '@/server/search/core';
import { searchDb } from '@/server/search/database';
import { BgeHttpEmbeddingProvider, type EmbeddingProvider } from '@/server/search/providers';

type IndexStats = {
  documentsProcessed: number;
  embeddingsCreated: number;
  unchangedSkipped: number;
  failures: number;
  durationMs: number;
};

async function collectCanonicalContent(): Promise<IndexDocument[]> {
  const sql = searchDb();
  const stories =
    await sql`SELECT id,team_id,story_type,headline,summary,what_happened,why_it_matters,whats_next,first_reported_at,last_meaningful_update_at,updated_at
    FROM canonical_stories WHERE publication_state IN ('AUTO_PUBLISHED','PUBLISHED')`;
  const articles =
    await sql`SELECT DISTINCT ON (c.id) c.id,c.title,c.excerpt,c.raw_text,c.canonical_url,c.published_at,c.updated_at,
    s.name AS source_name,s.url AS source_url,cs.id AS story_id,cs.team_id
    FROM content_candidates c JOIN content_sources s ON s.id=c.source_id
    JOIN story_evidence e ON e.content_candidate_id=c.id JOIN canonical_stories cs ON cs.id=e.story_id
    WHERE cs.publication_state IN ('AUTO_PUBLISHED','PUBLISHED') ORDER BY c.id,cs.last_meaningful_update_at DESC`;

  const players: IndexDocument[] = NFL_LEAGUE_DATA.players.map((player) => ({
    id: `player:${player.id}`,
    sourceType: 'player',
    sourceId: player.id,
    teamId: player.teamAbbr,
    type: 'player',
    title: player.name,
    summary: `${player.position} · ${player.teamAbbr}`,
    content: [
      `${player.name} plays ${player.position} for ${player.teamAbbr}.`,
      player.age ? `Age ${player.age}.` : '',
      player.height ? `Height ${player.height}.` : '',
      player.weight ? `Weight ${player.weight} pounds.` : '',
    ]
      .filter(Boolean)
      .join(' '),
    url: `/roster?team=${player.teamAbbr}`,
    sourceName: 'Down & Distance roster',
    sourceUrl: null,
    publishedAt: null,
    updatedAt: NFL_LEAGUE_DATA.updatedAt,
    image: player.headshotUrl,
    canonicalStoryId: null,
    metadata: { position: player.position, age: player.age },
  }));

  return [
    ...stories.map((row) => ({
      id: `story:${row.id}`,
      sourceType: 'canonical_story',
      sourceId: row.id,
      teamId: row.team_id,
      type: 'story' as const,
      title: row.headline,
      summary: row.summary,
      content: [row.what_happened, row.why_it_matters, row.whats_next].filter(Boolean).join('\n'),
      url: `/the-beat?team=${row.team_id}&story=${row.id}`,
      sourceName: 'Down & Distance',
      sourceUrl: null,
      publishedAt: row.first_reported_at?.toISOString() ?? null,
      updatedAt: (row.last_meaningful_update_at ?? row.updated_at).toISOString(),
      image: null,
      canonicalStoryId: row.id,
      metadata: { storyType: row.story_type },
    })),
    ...articles.map((row) => ({
      id: `article:${row.id}`,
      sourceType: 'article',
      sourceId: row.id,
      teamId: row.team_id,
      type: 'article' as const,
      title: row.title,
      summary: row.excerpt,
      content: row.raw_text || row.excerpt,
      url: row.canonical_url,
      sourceName: row.source_name,
      sourceUrl: row.source_url,
      publishedAt: row.published_at?.toISOString() ?? null,
      updatedAt: row.updated_at.toISOString(),
      image: null,
      canonicalStoryId: row.story_id,
      metadata: {},
    })),
    ...players,
  ];
}

export async function indexSearchDocuments({
  full = false,
  embeddingProvider = new BgeHttpEmbeddingProvider(),
}: { full?: boolean; embeddingProvider?: EmbeddingProvider } = {}): Promise<IndexStats> {
  const started = Date.now();
  const sql = searchDb();
  const documents = await collectCanonicalContent();
  const rows = documents.flatMap((document) => {
    const chunks = chunkText(`${document.title}\n${document.summary}\n${document.content}`);
    return (chunks.length ? chunks : ['']).map((content, chunkIndex) => ({
      ...document,
      chunkIndex,
      content,
      hash: contentHash(`${document.updatedAt}\n${content}`),
      rowId: `${document.sourceType}:${document.sourceId}:${chunkIndex}`,
    }));
  });
  const existing = await sql`SELECT id,content_hash FROM search_documents`;
  const hashes = new Map(existing.map((row) => [row.id as string, row.content_hash as string]));
  const changed = full ? rows : rows.filter((row) => hashes.get(row.rowId) !== row.hash);
  let embeddingsCreated = 0;
  let failures = 0;

  for (let offset = 0; offset < changed.length; offset += 32) {
    const batch = changed.slice(offset, offset + 32);
    let embeddings: Array<number[] | null> = batch.map(() => null);
    try {
      embeddings = await embeddingProvider.embedBatch(batch.map((row) => row.content));
      embeddingsCreated += embeddings.length;
    } catch (error) {
      failures += batch.length;
      console.warn('[search-index] embeddings unavailable; indexing lexical content only', error);
    }
    await sql.begin(async (tx) => {
      for (let index = 0; index < batch.length; index += 1) {
        const row = batch[index];
        const embedding = embeddings[index] ? JSON.stringify(embeddings[index]) : null;
        await tx`INSERT INTO search_documents
          (id,source_type,source_id,chunk_index,team_id,result_type,title,content,summary,url,source_name,source_url,published_at,source_updated_at,image_url,canonical_story_id,content_hash,embedding,metadata,active,indexed_at)
          VALUES (${row.rowId},${row.sourceType},${row.sourceId},${row.chunkIndex},${row.teamId},${row.type},${row.title},${row.content},${row.summary},${row.url},${row.sourceName},${row.sourceUrl},${row.publishedAt},${row.updatedAt},${row.image},${row.canonicalStoryId},${row.hash},${embedding}::vector,${tx.json(row.metadata as any)},true,now())
          ON CONFLICT (source_type,source_id,chunk_index) DO UPDATE SET team_id=excluded.team_id,result_type=excluded.result_type,title=excluded.title,content=excluded.content,summary=excluded.summary,url=excluded.url,source_name=excluded.source_name,source_url=excluded.source_url,published_at=excluded.published_at,source_updated_at=excluded.source_updated_at,image_url=excluded.image_url,canonical_story_id=excluded.canonical_story_id,content_hash=excluded.content_hash,embedding=COALESCE(excluded.embedding,search_documents.embedding),metadata=excluded.metadata,active=true,indexed_at=now()`;
      }
    });
  }

  const activeIds = rows.map((row) => row.rowId);
  if (activeIds.length) {
    await sql`UPDATE search_documents SET active=false,indexed_at=now() WHERE source_type IN ('canonical_story','article','player') AND NOT (id=ANY(${activeIds}))`;
  }
  const stats = {
    documentsProcessed: changed.length,
    embeddingsCreated,
    unchangedSkipped: rows.length - changed.length,
    failures,
    durationMs: Date.now() - started,
  };
  console.info(JSON.stringify({ metric: 'search_index_complete', ...stats }));
  return stats;
}

export async function indexDocument(sourceType: string, sourceId: string) {
  // The incremental reconciliation uses content hashes, so this safely updates only changed rows.
  // sourceType/sourceId are retained in this API for event-driven callers and future targeted collectors.
  void sourceType;
  void sourceId;
  return indexSearchDocuments();
}
