import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { assertSameOrigin, authError } from '@/server/auth/http';
import { answerTriviaGameQuestion } from '@/server/trivia/game-repository';
import { triviaPlayer } from '@/server/trivia/guest';
export async function POST(r: NextRequest, { params }: { params: { gameId: string } }) {
  try {
    assertSameOrigin(r);
    const player = await triviaPlayer(r);
    if (!player) return authError('Unauthorized.', 401);
    const { selectedAnswer } = z
      .object({ selectedAnswer: z.enum(['A', 'B', 'C', 'D']).nullable() })
      .parse(await r.json());
    return NextResponse.json({
      ok: true,
      result: await answerTriviaGameQuestion(player.id, params.gameId, selectedAnswer),
    });
  } catch (e) {
    return authError((e as Error).message);
  }
}
