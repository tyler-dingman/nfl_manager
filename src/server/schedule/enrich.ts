import{applicationBackend,applicationStorage}from'../persistence/bindings';
import{D1EditorialIngestion}from'../../../packages/storage/editorial-ingestion';
import{ReferenceData}from'../../../packages/storage/reference';
import { authDb } from '@/server/auth/database';
import { beatGameMetadata } from '@/lib/canonical-game';
import { enrichBeatTransaction } from '@/server/content/beat-transactions';
import { listCanonicalGames } from './repository';
import { gameStoryHints, resolveStoryGame, type GameStory, type GameResolution } from './resolve';

export async function enrichGameStories<T extends GameStory>(stories: T[], persist = true) {
  if (!stories.length) return [];
  const d1=applicationBackend()==='d1',s=d1?applicationStorage():null,db=d1?null:authDb();
  const ids = stories.map((s) => s.id).filter((id) => /^[\da-f-]{36}$/i.test(id));
  const links = ids.length
    ? d1?await Promise.all(ids.map(async id=>{const story=await new D1EditorialIngestion(s!).storyById(id),[link]=await s!.rows<any>('SELECT game_id,resolution_json FROM app_story_game_links WHERE story_id=?',[id]);return{id,game_id:link?.game_id,game_resolution:link?JSON.parse(link.resolution_json):undefined,first_reported_at:story?new Date(story.firstReportedAt):null};})):await db!`SELECT id,game_id,game_resolution,first_reported_at FROM canonical_stories WHERE id=ANY(${ids}::uuid[])`
    : [];
  const stored = new Map(links.map((r) => [r.id, r]));
  const inputs = stories.map((s) => ({
    ...s,
    gameId: s.gameId ?? stored.get(s.id)?.game_id,
    publishedAt: s.publishedAt ?? stored.get(s.id)?.first_reported_at?.toISOString() ?? s.updatedAt,
  }));
  const seasons = [...new Set(inputs.map((s) => gameStoryHints(s).season).filter(Number.isFinite))];
  // Include explicitly linked seasons, including archival articles refreshed much later.
  if (links.some((r) => r.game_id))
    for (const r of d1?(await new ReferenceData(s!).values<any[]>('SCHEDULE')).flat().filter(g=>links.some(l=>l.game_id===g.id)):await db!`SELECT DISTINCT season FROM historical_games WHERE id=ANY(${links.filter((r) => r.game_id).map((r) => r.game_id)}::uuid[])`)
      if (!seasons.includes(r.season)) seasons.push(r.season);
  const games = await listCanonicalGames(seasons);
  const enriched = inputs.map((s) => {
    const resolved = resolveStoryGame(s, games);
    const previous = stored.get(s.id)?.game_resolution as GameResolution | undefined;
    const gameResolution =
      resolved.method === 'explicit-game-id' &&
      previous &&
      previous.gameId === resolved.gameId &&
      previous.confidence === 'high'
        ? previous
        : resolved;
    const game = games.find((g) => g.id === gameResolution.gameId);
    const metadata = game ? beatGameMetadata(game, gameStoryHints(s).own!) : undefined;
    return {
      ...s,
      gameId: game?.id,
      gameResolution,
      game: metadata,
      graphicDecision: enrichBeatTransaction({ ...s, game: metadata }),
    };
  });
  if(persist&&d1){const writes=enriched.filter(x=>stored.has(x.id)&&gameStoryHints(x).relevant).map(x=>s!.statement('INSERT INTO app_story_game_links(story_id,game_id,resolution_json,updated_at) VALUES(?,?,?,?) ON CONFLICT(story_id) DO UPDATE SET game_id=excluded.game_id,resolution_json=excluded.resolution_json,updated_at=excluded.updated_at',[x.id,x.gameId??null,JSON.stringify(x.gameResolution),Date.now()]));for(let i=0;i<writes.length;i+=50)await s!.batch(writes.slice(i,i+50));}
  if (persist&&!d1)
    await db!.begin(async (tx) => {
      for (const s of enriched) {
        if (!stored.has(s.id) || !gameStoryHints(s).relevant) continue;
        const resolution: GameResolution = s.gameResolution;
        await tx`UPDATE canonical_stories SET game_id=${s.gameId ?? null},game_resolution=${tx.json(resolution)} WHERE id=${s.id} AND (game_id IS DISTINCT FROM ${s.gameId ?? null}::uuid OR game_resolution IS DISTINCT FROM ${tx.json(resolution)}::jsonb)`;
      }
    });
  return enriched;
}
