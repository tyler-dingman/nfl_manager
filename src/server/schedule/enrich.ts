import { authDb } from '@/server/auth/database';
import { beatGameMetadata } from '@/lib/canonical-game';
import { enrichBeatTransaction } from '@/server/content/beat-transactions';
import { listCanonicalGames } from './repository';
import { gameStoryHints, resolveStoryGame, type GameStory, type GameResolution } from './resolve';

export async function enrichGameStories<T extends GameStory>(stories: T[], persist = true) {
  if (!stories.length) return [];
  const db = authDb();
  const ids = stories.map((s) => s.id).filter((id) => /^[\da-f-]{36}$/i.test(id));
  const links = ids.length
    ? await db`SELECT id,game_id,game_resolution,first_reported_at FROM canonical_stories WHERE id=ANY(${ids}::uuid[])`
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
    for (const r of await db`SELECT DISTINCT season FROM historical_games WHERE id=ANY(${links.filter((r) => r.game_id).map((r) => r.game_id)}::uuid[])`)
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
  if (persist)
    await db.begin(async (tx) => {
      for (const s of enriched) {
        if (!stored.has(s.id) || !gameStoryHints(s).relevant) continue;
        const resolution: GameResolution = s.gameResolution;
        await tx`UPDATE canonical_stories SET game_id=${s.gameId ?? null},game_resolution=${tx.json(resolution)} WHERE id=${s.id} AND (game_id IS DISTINCT FROM ${s.gameId ?? null}::uuid OR game_resolution IS DISTINCT FROM ${tx.json(resolution)}::jsonb)`;
      }
    });
  return enriched;
}
