import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { assertSameOrigin, authError } from '@/server/auth/http';
import { createTriviaGame } from '@/server/trivia/game-repository';
import { TEAM_LIST } from '@/data/teams';
import { setTriviaGuestCookie, triviaPlayer } from '@/server/trivia/guest';
export async function POST(r: NextRequest) {
  try {
    assertSameOrigin(r);
    const player = await triviaPlayer(r, true);
    if (!player) return authError('Unable to start Trivia.', 401);
    const input = z
      .object({
        teamId: z.string().transform((v) => v.toUpperCase()),
      })
      .parse(await r.json());
    if (!TEAM_LIST.some((t) => t.abbr === input.teamId)) return authError('Unknown team.');
    const response = NextResponse.json(
      { ok: true, ...(await createTriviaGame(player.id, input.teamId)) },
      { status: 201 },
    );
    if (player.token) setTriviaGuestCookie(response, player.token);
    return response;
  } catch (e) {
    return authError((e as Error).message);
  }
}
