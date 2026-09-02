import { NextRequest, NextResponse } from 'next/server';

import { authError } from '@/server/auth/http';
import { currentUser } from '@/server/auth/request';
import { getMoveTheChainsAccount, getTriviaStats } from '@/server/trivia/repository';

export async function GET(request: NextRequest) {
  const user = await currentUser(request);
  if (!user) return authError('Unauthorized.', 401);
  const [stats, moveTheChains] = await Promise.all([
    getTriviaStats(user.id),
    getMoveTheChainsAccount(user.id),
  ]);
  return NextResponse.json({ ok: true, stats, moveTheChains });
}
