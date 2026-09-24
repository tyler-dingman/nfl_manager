import { NextRequest, NextResponse } from 'next/server';
import { authError } from '@/server/auth/http';
import { getTriviaGame, getTriviaLiveState } from '@/server/trivia/game-repository';
import { triviaPlayer } from '@/server/trivia/guest';
export async function GET(r: NextRequest, { params }: { params: { gameId: string } }) {
  try {
    const player = await triviaPlayer(r);
    if (!player) return authError('Unauthorized.', 401);
    if (r.nextUrl.searchParams.get('live') === '1')
      return NextResponse.json({
        ok: true,
        live: await getTriviaLiveState(player.id, params.gameId),
      });
    return NextResponse.json({ ok: true, game: await getTriviaGame(player.id, params.gameId) });
  } catch (e) {
    return authError((e as Error).message, 404);
  }
}
