import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getTriviaLeaderboard } from '@/server/trivia/game-repository';
export async function GET(r: NextRequest) {
  const scope = z
    .enum(['GLOBAL', 'TEAM'])
    .catch('GLOBAL')
    .parse(r.nextUrl.searchParams.get('scope'));
  const period = z
    .enum(['WEEK', 'ALL_TIME'])
    .catch('WEEK')
    .parse(r.nextUrl.searchParams.get('period'));
  const team = r.nextUrl.searchParams.get('team')?.toUpperCase() ?? null;
  const rows = await getTriviaLeaderboard(scope, team, period);
  return NextResponse.json({ ok: true, scope, period, rows });
}
