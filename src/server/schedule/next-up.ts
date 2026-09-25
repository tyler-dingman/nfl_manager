import { nextCanonicalGame } from './repository';
import { nextGameMarkets } from '@/server/odds/next-game-markets';
import { scheduleFailure } from './diagnostics';

export async function loadNextUp(team: string, stores = { nextCanonicalGame, nextGameMarkets }) {
  const game = await stores.nextCanonicalGame(team);
  console.info('[next-game] Schedule query completed', {
    team,
    source: 'historical_games',
    recordsReturned: game ? 1 : 0,
    gameId: game?.id,
  });
  // Optional market failures must never discard a usable matchup.
  const betting = game
    ? await stores.nextGameMarkets(game).catch((error) => {
        console.error('[next-game] Saved markets unavailable', {
          team,
          gameId: game.id,
          source: 'sportsbook_events/bet_markets',
          ...scheduleFailure(error),
        });
        return null;
      })
    : null;
  return { game, betting };
}
